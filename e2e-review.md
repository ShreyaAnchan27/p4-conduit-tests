# My end-to-end tests and review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you found and decided.

App: Conduit practice app · Test file: `P4/tests/e2e.spec.ts` · Date: 2026-11-18

## 1. My first look
- **After I published an article by hand, I would check:** I would check that my new article appears at the top of the Global Feed, with the exact title I typed. That one check shows the whole journey worked: I was signed in, the article was saved, and it was published where everyone can see it. To be even more sure, I'd also check that: The description I typed is shown under the title. The author name is the practice author. Clicking the article opens it and shows the text I wrote.
- **Where the page keeps my sign-in:** localStorage, key `jwtToken`

## 2. Practice
- **Worked example (the like test):** it signs in through the form as a practice user, so other tests can change its data.
- **Does its check at the end prove the journey?** No. Line 19 only checks that the article heading is visible. It does not prove that the article was liked. A better check would use the API after clicking Favorite Article to verify: favorited is true. favoritesCount is 1. That proves the like was actually saved, not just that the article page loaded successfully.

## 3. My prompt
```text
Task: Write 2 end-to-end tests in P4/tests/e2e.spec.ts. Test 1: a signed-in user publishes a new article in the editor. Test 2: a signed-in user posts a comment on an article. Make a new user with the API, give the page its token, do the journey in the page, and check the result with the API at the end. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/app/public/app.js app.js is the page's code: take the labels and button names from it. The page keeps the sign-in token in localStorage, key jwtToken.
Rules: Use app.js only for the labels and button names. Do not change the app. Do not run the tests. At the end of each test, verify the result using the API: for the publish test, confirm the article exists with the expected title and body; for the comment test, confirm the comment exists on the correct article with the expected text.
```

## 4. The run
- **Claude's 2 tests:** 2 passed, 0 failed.

## 5. The teammate's question
- **Claude said:** "7. Yes. Each test makes its own users and data." At the end, Claude also wrote: "The tests do not delete their users, articles or comments, so these stay in the app after a run."
- **My answer:** No, the app is not clean after a test run. Each test creates its own user and data, but Claude does not delete them afterward. The users, articles, and comments remain in the app even after the tests finish.

## 6. What I saw on the home page
- Asha Testone article for comments 1794987987727-5 and Asha Testone E2E article 1794987985703-2

## 7. My change
- **My line to Claude:** In @P4/tests/e2e.spec.ts, the tests leave behind the users, published articles, and comments they create. Add a test.afterEach teardown to delete the test data created by each test using the API. Ensure cleanup runs even if a test fails. Do not run the tests.
- **The clean-up Claude added:** test.afterEach deletes the comments and articles each test made, then checks the article is gone (404). The users stay: API.md has no request to delete a user.

## 8. Proof
- **Each test twice, on an app that keeps its data:** `npx playwright test tests/e2e.spec.ts --repeat-each=2` → 4 passed, 0 failed
- **The newest article on the home page after the run:** Your first end-to-end test
