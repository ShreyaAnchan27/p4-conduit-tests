// spec: specs/plan.md
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext } from '@playwright/test';

// The test makes its own author and reader by API, so it does not depend on
// shared practice users or on data left by other runs.
// A number is added to the username, email and texts, so every run uses new data
// (API.md: a taken username or email gives 409).
const PASSWORD = 'Asha-test-pass-1'; // API.md: at least 8 characters

let runCount = 0;
function uniqueId() {
  runCount += 1;
  return `${Date.now()}-${runCount}`;
}

type TestUser = { username: string; email: string; token: string };
let testUsers: TestUser[] = [];
// Follows made by this test: [reader, author], so the teardown can undo them.
let follows: { reader: TestUser; author: TestUser }[] = [];

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Signs up a new user (POST /api/users) and returns the username, email and token.
async function signUp(request: APIRequestContext) {
  const id = uniqueId();
  const username = `asha-testone-${id}`;
  const email = `asha.test+${id}@example.com`;
  const response = await request.post('/api/users', {
    data: { user: { username, email, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json.user.username).toBe(username);
  const user: TestUser = { username, email, token: json.user.token as string };
  testUsers.push(user);
  return user;
}

test.describe('Profile follow', () => {
  // Teardown: runs after every test, also when the test fails.
  // expect.soft: a failed step is reported, but the other steps still run.
  test.afterEach(async ({ request }) => {
    const users = testUsers;
    const madeFollows = follows;
    testUsers = [];
    follows = [];

    // 1. Undo the follows. API.md: DELETE /api/profiles/:username/follow gives 200.
    for (const f of madeFollows) {
      const res = await request.delete(`/api/profiles/${encodeURIComponent(f.author.username)}/follow`, {
        headers: authHeader(f.reader.token),
      });
      expect.soft(res.status()).toBe(200);
    }

    // 2. Delete every article written by a user from this test. API.md: author only, 204.
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

    // 3. Users: API.md has no request to delete a user, so the users stay.
  });

  test('Signed-in reader unfollows and follows an author, and the state survives a reload', async ({ page, request }) => {
    // Set up with the API: a new author with one article, and a new reader who follows the author.
    const author = await signUp(request);
    const reader = await signUp(request);
    const id = uniqueId();
    const articleTitle = `Asha Testone follow article ${id}`;
    const created = await request.post('/api/articles', {
      headers: authHeader(author.token),
      data: {
        article: {
          title: articleTitle,
          description: 'An article for the follow test',
          body: 'The body text of the article for the follow test.',
          tagList: [],
        },
      },
    });
    expect(created.status()).toBe(201);

    const followed = await request.post(`/api/profiles/${encodeURIComponent(author.username)}/follow`, {
      headers: authHeader(reader.token),
    });
    expect(followed.status()).toBe(200);
    expect((await followed.json()).profile.following).toBe(true);
    follows.push({ reader, author });

    // exact: true is needed because "Follow <author>" is a substring of "Unfollow <author>"
    const followButton = page.getByRole('button', { name: `Follow ${author.username}`, exact: true });
    const unfollowButton = page.getByRole('button', { name: `Unfollow ${author.username}`, exact: true });

    // 1. Sign in at /login, then open the author's profile
    await page.goto('/login');
    await page.getByLabel('Email').fill(reader.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('link', { name: reader.username })).toBeVisible();
    await page.goto(`/profile/${encodeURIComponent(author.username)}`);
    await expect(unfollowButton).toBeVisible();
    await expect(followButton).toHaveCount(0);

    // 2. Click button "Unfollow <author>"
    await unfollowButton.click();
    await expect(followButton).toBeVisible();
    await expect(unfollowButton).toHaveCount(0);

    // 3. Reload the page
    await page.reload();
    await expect(followButton).toBeVisible();
    await expect(unfollowButton).toHaveCount(0);

    // 4. Click button "Follow <author>"
    await followButton.click();
    await expect(unfollowButton).toBeVisible();

    // 5. Reload the page
    await page.reload();
    await expect(unfollowButton).toBeVisible();
    await expect(followButton).toHaveCount(0);
    await expect(page.getByRole('heading', { name: author.username, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: articleTitle })).toBeVisible();
  });
});
