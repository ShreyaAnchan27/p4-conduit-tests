// spec: Profile follow
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext } from '@playwright/test';

// The test makes its own author by API, so it does not depend on the shared
// practice-author user or on data left by other runs.
// A number is added to the username, email and texts, so every run uses new data
// (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters
const BIO = 'I write about testing and quality.';

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

test.describe('Profile follow', () => {
  // Teardown: runs after every test, also when the test fails.
  // expect.soft: a failed delete is reported, but the other deletes still run.
  test.afterEach(async ({ request }) => {
    const users = testUsers;
    testUsers = [];

    // 1. Delete every article written by a user from this test. API.md: author only, 204.
    for (const user of users) {
      const list = await request.get(`/api/articles?author=${encodeURIComponent(user.username)}`);
      expect.soft(list.status()).toBe(200);
      if (list.status() !== 200) continue;
      for (const a of (await list.json()).articles) {
        const path = `/api/articles/${encodeURIComponent(a.slug)}`;
        const del = await request.delete(path, { headers: authHeader(user.token) });
        expect.soft(del.status()).toBe(204);
        const gone = await request.get(path);
        expect.soft(gone.status()).toBe(404);
      }
    }

    // 2. Users: API.md has no request to delete a user, so the users stay.
  });

  test('Signed-out visitor sees the profile without a follow button', async ({ page, request }) => {
    // Set up with the API: a new author with a bio and one article.
    const author = await signUp(request);
    const id = uniqueId();

    const updated = await request.put('/api/user', {
      headers: authHeader(author.token),
      data: { user: { bio: BIO } },
    });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).user.bio).toBe(BIO);

    const articleTitle = `Asha Testone profile article ${id}`;
    const created = await request.post('/api/articles', {
      headers: authHeader(author.token),
      data: {
        article: {
          title: articleTitle,
          description: 'An article for the signed-out profile test',
          body: 'The body text of the article for the signed-out profile test.',
          tagList: [],
        },
      },
    });
    expect(created.status()).toBe(201);

    const checkProfile = async () => {
      await expect(page.getByRole('heading', { name: author.username, level: 1 })).toBeVisible();
      await expect(page.getByText(BIO)).toBeVisible();
      await expect(page.getByRole('link', { name: 'My Articles' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Favorited Articles' })).toBeVisible();
      await expect(page.getByRole('heading', { name: articleTitle })).toBeVisible();
      await expect(page.getByRole('button', { name: `Follow ${author.username}` })).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Unfollow ${author.username}` })).toHaveCount(0);
    };

    // 1. Without signing in, open the author's profile.
    await page.goto(`/profile/${encodeURIComponent(author.username)}`);
    await checkProfile();

    // 2. Reload the page.
    await page.reload();
    await checkProfile();
  });
});
