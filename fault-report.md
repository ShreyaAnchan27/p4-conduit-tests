# My practice fault report (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Practice faults: `P4/faults/practice.json` (F1 to F6) · Date: 2026-11-19
**How to read it:** a "detect" fault is **caught** when at least one test that passed with no fault fails with it, and **missed** when every test still passes. A "robust" fault (the app is only slower) should **stay green**; if tests fail, it **went red**.

## 1. My guess this morning
- **The developer asked:** "Your suite is green. How many real problems would it catch?"
- **My answer:** 17 passing tests sounds good, but I don't know how many real bugs they catch. I'd try mutation testing by introducing small bugs and checking how many the tests detect.

## 2. Before: my suite against the practice faults
- **Command:** `node materials/faults-run.mjs` (TESTS terminal, in `P4`, with no app running)
- **My test files:** `api.spec.ts`, `contract.spec.ts`, `e2e.spec.ts`, `example.spec.ts`, `profile-follow/follow-author.spec.ts`, `profile-follow/signed-out-profile.spec.ts`, `seed.spec.ts`
- **No fault:** 20 passed, 0 failed
- **F1:** caught (11 tests failed) · Opening an article gives a server error (500)
- **F2:** caught (6 tests failed) · The article answer has no body text
- **F3:** caught (8 tests failed) · The article answer has a different title
- **F4:** caught (1 test failed: e2e.spec.ts › a signed-in user posts a comment on an article) · The comments list is always empty
- **F5:** stayed green (0 tests failed) · The article answer comes 3 seconds late
- **F6:** caught (1 test failed: the same e2e comment test) · Posting a comment is refused (422) and nothing is saved

## 3. The weak spot I chose, and why
The suite is weakest at comment testing. F4 and F6 were caught by only one test. I'd add independent tests to check that comments are displayed correctly and successfully saved after posting.

## 4. How I made the suite stronger
- **My request for Claude** (the New tests line of `P4/prompts/stronger.md`): Add more comment tests in P4/tests/comments.spec.ts using the API. Test that a user can post a comment, that the comment is saved, and that GET returns the correct comment. Also test that failed comment submissions are handled correctly. Use a new user for each test, not shared practice users.
- **New or changed test file:** `tests/comments.spec.ts` (new, 7 tests); `tests/profile-follow/follow-author.spec.ts` and `tests/profile-follow/signed-out-profile.spec.ts` (changed to make their own users)
- **A red No fault line on the first run again:** comments.spec.ts › posting an empty comment gives 422 and saves nothing (Expected: 422, Received: 201). My decision: The app is wrong. API.md says an empty comment must return 422, but the app returns 201. Keep the test and use test.fail() to mark this known bug until the app is fixed.

## 5. After: the run again
- **Command:** `node materials/faults-run.mjs F4 F6`
- **No fault:** 27 passed, 0 failed
- **The fault I chose:** F4: caught (3 tests failed, was 1) · F6: caught (6 tests failed, was 1)

## 6. What changed
Our suite has improved from 20 to 27 tests. The comment tests now catch more problems: F4 went from 1 to 3 failures, and F6 from 1 to 6 genuine catches. We still have gaps, but mutation testing shows our tests are getting stronger.
