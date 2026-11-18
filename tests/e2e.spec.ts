import { test, expect, APIRequestContext, Page } from '@playwright/test';

// End-to-end tests: the API sets up, the page does the journey, the API checks the result.
// Shared test data, kept in one place. Made-up data only.
// A number is added to the username, email and texts, so every run uses new data
// (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters

let runCount = 0;
function uniqueId() {
  runCount += 1;
  return `${Date.now()}-${runCount}`;
}

// Every user a test signs up is kept here, so the teardown can clean up after them.
type TestUser = { username: string; token: string };
let testUsers: TestUser[] = [];

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

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Gives the page the user's token. app.js reads it from localStorage, key "jwtToken".
// The script runs before app.js on every page load, so the page starts signed in.
async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('jwtToken', t);
  }, token);
}

test.describe('Conduit end-to-end', () => {
  // Teardown. Playwright runs afterEach after every test, also when the test fails.
  // It finds the data through the API, not through the test's own variables,
  // so it also cleans up when a test stops halfway.
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

      // 2. Delete the comments on it that a user from this test wrote.
      //    API.md: only the comment author may delete a comment, so use their token.
      const commentsRes = await request.get(`${path}/comments`);
      expect.soft(commentsRes.status()).toBe(200);
      if (commentsRes.status() === 200) {
        for (const c of (await commentsRes.json()).comments) {
          const token = tokenOf.get(c.author.username);
          if (!token) continue; // not ours: leave it
          const del = await request.delete(`${path}/comments/${c.id}`, { headers: authHeader(token) });
          expect.soft(del.status()).toBe(204);
        }
        // Check with GET: none of our comments are left.
        const after = await request.get(`${path}/comments`);
        const left = (await after.json()).comments.filter((c: { author: { username: string } }) => tokenOf.has(c.author.username));
        expect.soft(left).toHaveLength(0);
      }

      // 3. Delete the article. API.md: author only, 204.
      const del = await request.delete(path, { headers: authHeader(tokenOf.get(article.author)!) });
      expect.soft(del.status()).toBe(204);
      // Check with GET: the article is gone (API.md: 404 when not found).
      const gone = await request.get(path);
      expect.soft(gone.status()).toBe(404);
    }

    // 4. Users: API.md has no request to delete a user, so the users stay.
  });

  test('a signed-in user publishes a new article in the editor', async ({ page, request }) => {
    // Set up with the API: a new user.
    const author = await signUp(request);
    const id = uniqueId();
    const article = {
      title: `Asha Testone E2E article ${id}`,
      description: 'A short description for the E2E test',
      body: `The body text of the E2E test article ${id}.`,
      tags: ['testing', 'e2e'],
    };

    // Journey in the page.
    await signInPage(page, author.token);
    await page.goto('/editor');
    await expect(page.getByRole('heading', { level: 1, name: 'New Article' })).toBeVisible();

    await page.getByLabel('Title', { exact: true }).fill(article.title);
    await page.getByLabel("What's this article about?").fill(article.description);
    await page.getByLabel('Write your article').fill(article.body);
    await page.getByLabel('Tags', { exact: true }).fill(article.tags.join(', '));
    await page.getByRole('button', { name: 'Publish Article' }).click();

    // The page opens the new article.
    await expect(page.getByRole('heading', { level: 1, name: article.title })).toBeVisible();
    await expect(page.getByText(article.body, { exact: true })).toBeVisible();

    // Check with the API: the user has exactly one article, with this title.
    const list = await request.get(`/api/articles?author=${encodeURIComponent(author.username)}`);
    expect(list.status()).toBe(200);
    const listJson = await list.json();
    expect(listJson.articlesCount).toBe(1);
    expect(listJson.articles[0].title).toBe(article.title);
    const slug = listJson.articles[0].slug as string;

    // The page shows the article that the API has.
    await expect(page).toHaveURL(`/article/${encodeURIComponent(slug)}`);

    // GET the article itself (the list has no body, API.md).
    const read = await request.get(`/api/articles/${encodeURIComponent(slug)}`);
    expect(read.status()).toBe(200);
    const saved = (await read.json()).article;
    expect(saved.title).toBe(article.title);
    expect(saved.body).toBe(article.body);
    expect(saved.description).toBe(article.description);
    expect(saved.tagList).toEqual(article.tags); // this app keeps the order sent
    expect(saved.author.username).toBe(author.username);
  });

  test('a signed-in user posts a comment on an article', async ({ page, request }) => {
    // Set up with the API: an author with an article, and a second user who comments.
    const author = await signUp(request);
    const commenter = await signUp(request);
    const id = uniqueId();
    const created = await request.post('/api/articles', {
      headers: authHeader(author.token),
      data: {
        article: {
          title: `Asha Testone article for comments ${id}`,
          description: 'An article for the E2E comment test',
          body: 'The body text of the article for comments.',
          tagList: [],
        },
      },
    });
    expect(created.status()).toBe(201);
    const { article } = await created.json();
    const commentText = `Asha Testone E2E comment ${id}`;

    // Journey in the page, signed in as the commenter.
    await signInPage(page, commenter.token);
    await page.goto(`/article/${encodeURIComponent(article.slug)}`);
    await expect(page.getByRole('heading', { level: 1, name: article.title })).toBeVisible();

    await page.getByLabel('Write a comment').fill(commentText);
    await page.getByRole('button', { name: 'Post Comment' }).click();

    // The page shows the new comment.
    await expect(page.getByText(commentText, { exact: true })).toBeVisible();

    // Check with the API: the article has exactly this one comment, by the commenter.
    const response = await request.get(`/api/articles/${encodeURIComponent(article.slug)}/comments`);
    expect(response.status()).toBe(200);
    const { comments } = await response.json();
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe(commentText);
    expect(comments[0].author.username).toBe(commenter.username);
  });
});
