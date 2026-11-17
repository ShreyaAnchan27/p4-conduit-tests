import { test, expect, APIRequestContext } from '@playwright/test';

// Shared test data, kept in one place.
// Made-up data only. A number is added to the username and email, so every
// sign-up is new (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters
const WRONG_TOKEN = 'this-is-not-a-real-token';
const ARTICLE = {
  title: 'Asha Testone contract article',
  description: 'A short description for the contract test',
  body: 'The body text of the contract test article.',
  tagList: ['testing', 'api'],
};

let userCount = 0;

// Signs up a new user (POST /api/users) and returns the username, email and token.
async function signUp(request: APIRequestContext) {
  userCount += 1;
  const id = `${Date.now()}-${userCount}`;
  const username = `asha-contract-${id}`;
  const email = `asha.test+contract-${id}@example.com`;
  const response = await request.post('/api/users', {
    data: { user: { username, email, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, email, token: json.user.token as string };
}

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Creates an article (POST /api/articles) and returns it.
async function createArticle(request: APIRequestContext, token: string) {
  const response = await request.post('/api/articles', {
    headers: authHeader(token),
    data: { article: ARTICLE },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article;
}

// Reads the article again and checks that it is still the article we created.
async function expectArticleUnchanged(request: APIRequestContext, slug: string) {
  const readBack = await request.get(`/api/articles/${slug}`);
  expect(readBack.status()).toBe(200);
  const { article } = await readBack.json();
  expect(article.title).toBe(ARTICLE.title);
  expect(article.description).toBe(ARTICLE.description);
  expect(article.body).toBe(ARTICLE.body);
  expect(article.tagList).toEqual(ARTICLE.tagList);
}

test.describe('Conduit API contract', () => {
  // ---------- Schema tests ----------

  test('GET /api/articles/:slug answers with the Article shape from API.md', async ({ request }) => {
    const author = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.get(`/api/articles/${created.slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();
    // API.md: Article = {"article":{"slug","title","description","body","tagList",
    // "createdAt","updatedAt","favorited","favoritesCount","author"}}.
    // author is a Profile = {"username","bio","image","following"}.
    expect(json).toMatchObject({
      article: {
        slug: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        body: expect.any(String),
        tagList: [expect.any(String), expect.any(String)], // we sent 2 tags
        createdAt: expect.any(String), // API.md: dates are ISO 8601 text
        updatedAt: expect.any(String),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: {
          username: expect.any(String),
          bio: null, // API.md: a new user has bio set to null
          image: null, // API.md: a new user has image set to null
          following: expect.any(Boolean),
        },
      },
    });

    // Exact key lists: an extra or missing field makes these checks fail.
    // Sorted, so the order of the keys in the answer does not matter.
    // API.md: the answer has only the "article" wrapper.
    expect(Object.keys(json).sort()).toEqual(['article']);
    // API.md: Article fields.
    expect(Object.keys(json.article).sort()).toEqual(
      [
        'slug',
        'title',
        'description',
        'body',
        'tagList',
        'createdAt',
        'updatedAt',
        'favorited',
        'favoritesCount',
        'author',
      ].sort(),
    );
    // API.md: author is a Profile without the "profile" wrapper.
    expect(Object.keys(json.article.author).sort()).toEqual(
      ['username', 'bio', 'image', 'following'].sort(),
    );
  });

  test('GET /api/user answers with the User shape from API.md', async ({ request }) => {
    const user = await signUp(request);

    const response = await request.get('/api/user', { headers: authHeader(user.token) });

    expect(response.status()).toBe(200);
    // API.md: User = {"user":{"email","token","username","bio","image"}}.
    expect(await response.json()).toMatchObject({
      user: {
        email: expect.any(String),
        token: expect.any(String),
        username: expect.any(String),
        bio: null, // API.md: a new user has bio set to null
        image: null, // API.md: a new user has image set to null
      },
    });
  });

  // ---------- Auth tests ----------

  test('changing an article with no token gives 401 and changes nothing', async ({ request }) => {
    const author = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${created.slug}`, {
      data: { article: { title: 'Asha Testone no token title' } },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
    await expectArticleUnchanged(request, created.slug);
  });

  test('changing an article with a wrong token gives 401 and changes nothing', async ({ request }) => {
    const author = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: authHeader(WRONG_TOKEN),
      data: { article: { title: 'Asha Testone wrong token title' } },
    });

    expect(response.status()).toBe(401);
    // API.md: this app says "is invalid" for a wrong token.
    expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });
    await expectArticleUnchanged(request, created.slug);
  });

  test("changing someone else's article gives 403 and changes nothing", async ({ request }) => {
    const author = await signUp(request);
    const otherUser = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: authHeader(otherUser.token),
      data: { article: { title: 'Asha Testone not allowed title' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });
    await expectArticleUnchanged(request, created.slug);
  });
});
