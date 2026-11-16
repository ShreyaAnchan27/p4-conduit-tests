import { test, expect, APIRequestContext } from '@playwright/test';

// Shared test data, kept in one place.
// Made-up data only. A number is added to the username and email, so every
// sign-up is new (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters
const ARTICLE = {
  title: 'Asha Testone API article',
  description: 'A short description for the API test',
  body: 'The body text of the API test article.',
  tagList: ['testing', 'api'],
};

let userCount = 0;

// Signs up a new user (POST /api/users) and returns the username and token.
async function signUp(request: APIRequestContext) {
  userCount += 1;
  const id = `${Date.now()}-${userCount}`;
  const username = `asha-testone-${id}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `asha.test+${id}@example.com`, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json.user.username).toBe(username);
  return { username, token: json.user.token as string };
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
  const json = await response.json();
  return json.article;
}

test.describe('Conduit articles API', () => {
  // ---------- Positive tests ----------

  test('a signed-in user can create an article', async ({ request }) => {
    const author = await signUp(request);

    const response = await request.post('/api/articles', {
      headers: authHeader(author.token),
      data: { article: ARTICLE },
    });

    expect(response.status()).toBe(201);
    const { article } = await response.json();
    expect(article.title).toBe(ARTICLE.title);
    expect(article.description).toBe(ARTICLE.description);
    expect(article.body).toBe(ARTICLE.body);
    expect(article.tagList).toEqual(ARTICLE.tagList); // this app keeps the order sent
    expect(article.author.username).toBe(author.username);
    expect(typeof article.slug).toBe('string');
    expect(article.slug).not.toBe('');
    expect(typeof article.createdAt).toBe('string');
    expect(typeof article.updatedAt).toBe('string');
  });

  test('anyone can read an article by its slug', async ({ request }) => {
    const author = await signUp(request);
    const created = await createArticle(request, author.token);

    // No token: API.md says the token is optional for GET /api/articles/:slug.
    const response = await request.get(`/api/articles/${created.slug}`);

    expect(response.status()).toBe(200);
    const { article } = await response.json();
    expect(article.slug).toBe(created.slug);
    expect(article.title).toBe(ARTICLE.title);
    expect(article.description).toBe(ARTICLE.description);
    expect(article.body).toBe(ARTICLE.body);
    expect(article.tagList).toEqual(ARTICLE.tagList);
    expect(article.author.username).toBe(author.username);
  });

  test('the author can change the title and body of an article', async ({ request }) => {
    // The app clears existing tags when updating an article without sending tagList.
    test.fail();
    const author = await signUp(request);
    const created = await createArticle(request, author.token);
    const newTitle = 'Asha Testone changed article';
    const newBody = 'The changed body text.';

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: authHeader(author.token),
      data: { article: { title: newTitle, body: newBody } },
    });

    expect(response.status()).toBe(200);
    const { article } = await response.json();
    expect(article.title).toBe(newTitle);
    expect(article.body).toBe(newBody);
    // Fields not sent stay as they were.
    expect(article.description).toBe(ARTICLE.description);
    expect(article.tagList).toEqual(ARTICLE.tagList);
    // This app: when the title changes, the slug changes too.
    expect(article.slug).not.toBe(created.slug);

    // The change is saved: reading the new slug gives the new data.
    const readBack = await request.get(`/api/articles/${article.slug}`);
    expect(readBack.status()).toBe(200);
    const saved = (await readBack.json()).article;
    expect(saved.title).toBe(newTitle);
    expect(saved.body).toBe(newBody);
    expect(saved.description).toBe(ARTICLE.description);
  });

  test('the author can delete an article', async ({ request }) => {
    const author = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.delete(`/api/articles/${created.slug}`, {
      headers: authHeader(author.token),
    });

    expect(response.status()).toBe(204);
    expect(await response.text()).toBe(''); // 204, no body

    // The article is gone.
    const readBack = await request.get(`/api/articles/${created.slug}`);
    expect(readBack.status()).toBe(404);
    expect(await readBack.json()).toEqual({ errors: { article: ['not found'] } });
  });

  // ---------- Negative tests ----------

  test('creating an article without a title gives 422', async ({ request }) => {
    const author = await signUp(request);

    const response = await request.post('/api/articles', {
      headers: authHeader(author.token),
      data: { article: { description: ARTICLE.description, body: ARTICLE.body } },
    });

    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ errors: { title: ["can't be blank"] } });
  });

  test('creating an article without a token gives 401', async ({ request }) => {
    const response = await request.post('/api/articles', {
      data: { article: ARTICLE },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
  });

  test('reading an article that does not exist gives 404', async ({ request }) => {
    const response = await request.get(`/api/articles/no-such-article-${Date.now()}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ errors: { article: ['not found'] } });
  });

  test("a user cannot change someone else's article", async ({ request }) => {
    const author = await signUp(request);
    const otherUser = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: authHeader(otherUser.token),
      data: { article: { title: 'Asha Testone not allowed title' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    // The article did not change.
    const readBack = await request.get(`/api/articles/${created.slug}`);
    expect(readBack.status()).toBe(200);
    expect((await readBack.json()).article.title).toBe(ARTICLE.title);
  });

  test("a user cannot delete someone else's article", async ({ request }) => {
    const author = await signUp(request);
    const otherUser = await signUp(request);
    const created = await createArticle(request, author.token);

    const response = await request.delete(`/api/articles/${created.slug}`, {
      headers: authHeader(otherUser.token),
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    // The article is still there.
    const readBack = await request.get(`/api/articles/${created.slug}`);
    expect(readBack.status()).toBe(200);
    expect((await readBack.json()).article.title).toBe(ARTICLE.title);
  });
});
