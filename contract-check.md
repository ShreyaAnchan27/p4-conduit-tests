# My schema, auth and contract checks (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-17

## 1. My first look
How I would check that an article answer has the right shape: I would write a test to check that the API response has all the fields mentioned in API.md. The test should check: All required fields are present. Each field has the correct data type. The author object has the correct fields. No important fields are missing after the app update. This ensures the new version does not break other apps that use the API.

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):** Missing bio: Fails (bio is missing). New field password: Fails (password is an extra field). Token is a number: Passes (the key name is still token).

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. In every schema test, check that all required fields are present and have the correct data types.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape from API.md"
- **Claude said:** "the status is 200, and the body has `article` with all 10 fields from API.md. Each field has the type API.md gives ..." (and at the end: "`toMatchObject` does not notice extra fields in the answer. I did not check for extra fields.")
- **My answer:** No. toMatchObject checks only the fields listed in the test. It will still pass if extra fields, like password, are added. To catch extra fields, we need an exact key list check using Object.keys().

## 6. My change
- **What I asked Claude:** "In @P4/tests/contract.spec.ts, the GET /api/articles/:slug schema test allows extra fields. Add an exact key list check using Object.keys() based on the Article fields in API.md, including the author fields. Do not run the tests."
- **The run after it:** 5 passed, 0 failed

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** The GET /api/articles/:slug schema test will fail because F2 removes a field from the article response. The exact key list check will detect that the required field is missing.
- **Run with the practice fault F2 on:** `$env:CONDUIT_FAULT = "F2"`, then `npx playwright test tests/contract.spec.ts` · **Result:** 1 passed, 4 failed (the article shape test, and the three auth tests: no token, wrong token, someone else's article)
- **What Playwright showed:** the article shape test: `-     "body": Any<String>,` (the body field is missing). The auth tests: Expected: "The body text of the contract test article." Received: undefined
- **My answer about a red test:** It failed because F2 removed the body field from the article response. The auth test expected the original article body, but received undefined. So the failure is caused by F2, not by the token check.
- **Run with the fault off again:** `$env:CONDUIT_FAULT = ""`, then the same run · **Result:** 5 passed, 0 failed
