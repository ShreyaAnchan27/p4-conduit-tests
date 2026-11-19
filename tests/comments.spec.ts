import { test, expect, APIRequestContext } from '@playwright/test';

// Comment tests through the API only (API.md, "Comments").
// Every test makes its own new users and article, and the teardown cleans up.
// A number is added to the username, email and texts, so every run uses new data
// (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters

let runCount = 0;
function uniqueId() {
  runCount += 1;
  return `${Date.now()}-${runCount}`;
}

type TestUser = { username: string; token: string };
let testUsers: TestUser[] = [];

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Signs up a new user (POST /api/users) and returns the username and token.
async function signUp(request: APIRequestContext) {
  const id = uniqueId();
  const username = `asha-testone-${id}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `asha.test+${id}@example.com`, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json.user.username).toBe(username);
  const user: TestUser = { username, token: json.user.token as string };
  testUsers.push(user);
  return user;
}

// Creates an article for the author (POST /api/articles, 201) and returns its slug.
async function createArticle(request: APIRequestContext, author: TestUser) {
  const id = uniqueId();
  const response = await request.post('/api/articles', {
    headers: authHeader(author.token),
    data: {
      article: {
        title: `Asha Testone article for comment API tests ${id}`,
        description: 'An article for the comment API tests',
        body: 'The body text of the article for the comment API tests.',
        tagList: [],
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article.slug as string;
}

function commentsPath(slug: string) {
  return `/api/articles/${encodeURIComponent(slug)}/comments`;
}

// GET /api/articles/:slug/comments, no token. API.md: 200 {"comments":[...]}.
async function getComments(request: APIRequestContext, slug: string) {
  const response = await request.get(commentsPath(slug));
  expect(response.status()).toBe(200);
  return (await response.json()).comments as any[];
}

test.describe('Comments API', () => {
  // Teardown, like tests/e2e.spec.ts. Runs after every test, also when the test fails.
  // expect.soft: a failed delete is reported, but the other deletes still run.
  test.afterEach(async ({ request }) => {
    const users = testUsers;
    testUsers = [];
    const tokenOf = new Map(users.map((u) => [u.username, u.token]));

    // 1. Find every article written by a user from this test.
    const articles: { slug: string; author: string }[] = [];
    for (const user of users) {
      const list = await request.get(`/api/articles?author=${encodeURIComponent(user.username)}`);
      expect.soft(list.status()).toBe(200);
      if (list.status() !== 200) continue;
      for (const a of (await list.json()).articles) {
        articles.push({ slug: a.slug, author: user.username });
      }
    }

    for (const article of articles) {
      const path = `/api/articles/${encodeURIComponent(article.slug)}`;

      // 2. Delete our comments on it. API.md: comment author only, 204.
      const commentsRes = await request.get(`${path}/comments`);
      expect.soft(commentsRes.status()).toBe(200);
      if (commentsRes.status() === 200) {
        for (const c of (await commentsRes.json()).comments) {
          const token = tokenOf.get(c.author.username);
          if (!token) continue; // not ours: leave it
          const del = await request.delete(`${path}/comments/${c.id}`, { headers: authHeader(token) });
          expect.soft(del.status()).toBe(204);
        }
        const after = await request.get(`${path}/comments`);
        const left = (await after.json()).comments.filter((c: { author: { username: string } }) => tokenOf.has(c.author.username));
        expect.soft(left).toHaveLength(0);
      }

      // 3. Delete the article. API.md: author only, 204. Then GET gives 404.
      const del = await request.delete(path, { headers: authHeader(tokenOf.get(article.author)!) });
      expect.soft(del.status()).toBe(204);
      const gone = await request.get(path);
      expect.soft(gone.status()).toBe(404);
    }

    // 4. Users: API.md has no request to delete a user, so the users stay.
  });

  test('a signed-in user posts a comment, it is saved, and GET returns it', async ({ request }) => {
    const author = await signUp(request);
    const commenter = await signUp(request);
    const slug = await createArticle(request, author);
    const commentText = `Asha Testone API comment ${uniqueId()}`;

    // POST the comment. API.md: 201 {"comment":{...}}.
    const posted = await request.post(commentsPath(slug), {
      headers: authHeader(commenter.token),
      data: { comment: { body: commentText } },
    });
    expect(posted.status()).toBe(201);
    const { comment } = await posted.json();

    // API.md: Comment has id, createdAt, updatedAt, body, author (a Profile).
    expect(comment.id).toBeDefined();
    expect(comment.body).toBe(commentText);
    expect(comment.author.username).toBe(commenter.username);
    expect(Number.isNaN(Date.parse(comment.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(comment.updatedAt))).toBe(false);

    // GET returns exactly this comment: same id, body and author.
    const comments = await getComments(request, slug);
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(comment.id);
    expect(comments[0].body).toBe(commentText);
    expect(comments[0].author.username).toBe(commenter.username);
    expect(comments[0].createdAt).toBe(comment.createdAt);
  });

  test('GET returns each comment with its own author, oldest first', async ({ request }) => {
    const author = await signUp(request);
    const firstUser = await signUp(request);
    const secondUser = await signUp(request);
    const slug = await createArticle(request, author);
    const firstText = `Asha Testone first comment ${uniqueId()}`;
    const secondText = `Asha Testone second comment ${uniqueId()}`;

    const first = await request.post(commentsPath(slug), {
      headers: authHeader(firstUser.token),
      data: { comment: { body: firstText } },
    });
    expect(first.status()).toBe(201);
    const second = await request.post(commentsPath(slug), {
      headers: authHeader(secondUser.token),
      data: { comment: { body: secondText } },
    });
    expect(second.status()).toBe(201);

    // API.md: this app lists comments oldest first.
    const comments = await getComments(request, slug);
    expect(comments).toHaveLength(2);
    expect(comments[0].body).toBe(firstText);
    expect(comments[0].author.username).toBe(firstUser.username);
    expect(comments[0].id).toBe((await first.json()).comment.id);
    expect(comments[1].body).toBe(secondText);
    expect(comments[1].author.username).toBe(secondUser.username);
    expect(comments[1].id).toBe((await second.json()).comment.id);
  });

  test('posting a comment without a token gives 401 and saves nothing', async ({ request }) => {
    const author = await signUp(request);
    const slug = await createArticle(request, author);

    const response = await request.post(commentsPath(slug), {
      data: { comment: { body: `Asha Testone comment without token ${uniqueId()}` } },
    });
    // API.md: 401 {"errors":{"token":["is missing"]}}.
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });

    expect(await getComments(request, slug)).toHaveLength(0);
  });

  test('posting a comment with a wrong token gives 401 and saves nothing', async ({ request }) => {
    const author = await signUp(request);
    const slug = await createArticle(request, author);

    const response = await request.post(commentsPath(slug), {
      headers: authHeader('not-a-real-token'),
      data: { comment: { body: `Asha Testone comment with wrong token ${uniqueId()}` } },
    });
    // API.md: this app says "is invalid" for a wrong token.
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });

    expect(await getComments(request, slug)).toHaveLength(0);
  });

  test('posting an empty comment gives 422 and saves nothing', async ({ request }) => {
    // The app saves an empty comment with 201, but API.md says 422.
    test.fail();
    const author = await signUp(request);
    const commenter = await signUp(request);
    const slug = await createArticle(request, author);

    const response = await request.post(commentsPath(slug), {
      headers: authHeader(commenter.token),
      data: { comment: { body: '' } },
    });
    // API.md: 422 {"errors":{"body":["can't be blank"]}}.
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ errors: { body: ["can't be blank"] } });

    expect(await getComments(request, slug)).toHaveLength(0);
  });

  test('posting a comment with no body field gives 422 and saves nothing', async ({ request }) => {
    const author = await signUp(request);
    const commenter = await signUp(request);
    const slug = await createArticle(request, author);

    const response = await request.post(commentsPath(slug), {
      headers: authHeader(commenter.token),
      data: { comment: {} },
    });
    // API.md: body is required; a missing field gives 422, and the error key names the field.
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.body).toBeDefined();

    expect(await getComments(request, slug)).toHaveLength(0);
  });

  test('posting a comment on an article that does not exist gives 404', async ({ request }) => {
    const commenter = await signUp(request);

    const response = await request.post(commentsPath(`no-such-article-${uniqueId()}`), {
      headers: authHeader(commenter.token),
      data: { comment: { body: `Asha Testone comment on a missing article ${uniqueId()}` } },
    });
    // API.md: 404 {"errors":{"article":["not found"]}}.
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ errors: { article: ['not found'] } });
  });
});
