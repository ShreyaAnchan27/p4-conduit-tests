# API review: Claude's first API tests (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you decided and what you saw.

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- first commnets for Post method . status was 201 Created . second commnet was Get method. status 200 Ok

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201 Created – Body contains comment with details such as id, body, and author. The app answered 201, a comment with id, body "Clear and useful." and author practice-reader.
- **B** (the same comment, with no token): I predicted 401 Unauthorized – Body: {"errors":{"token":["is missing"]}} The app answered 401, {"errors":{"token":["is missing"]}}.
- **C** (a comment on an article that does not exist): I predicted 404 Not Found – Body: {"errors":{"article":["not found"]}} The app answered 404, {"errors":{"article":["not found"]}}.

The answer that surprised me most: The most interesting response is B (401 Unauthorized) because even though the request is valid, it fails without an authentication token. The app checks whether the user is authenticated before allowing them to post a comment. Since the Authorization header is missing, the API returns 401 with the error "token is missing".

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Verify the response body as well as the status code, including the expected article data and error messages for negative tests.
```

## 4. The run
- **Result:** 9 tests: 8 passed, 1 failed.
- **A red test, and who is wrong:**
  - **Test:** "the author can change the title and body of an article" (line 86; the failed check was the tagList check)
  - **Expected:** ["testing", "api"] · **Received:** []
  - **API.md says:** "Updating: every field is optional. A field you do not send stays as it was."
  - **My answer:** The app is wrong here. According to API.md, when updating an article, any field that is not sent must remain unchanged. Since tagList was not included in the update request, it should still contain ["testing", "api"], but the app returned an empty list. The test is correct, and we should keep it to expose the bug rather than change the expected result.
- **My note** (the test is kept, with `test.fail()`): The app clears existing tags when updating an article without sending tagList.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "creating an article without a title gives 422" (lines 137–147)
- **My answer:** Not necessarily. A 422 response with the expected error message confirms that the API rejected the request, but it does not prove that no article was saved. We should also verify that the article was not created, for example by checking that it cannot be found afterward.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "a signed-in user can create an article" (lines 48–67)
- **My decision:** Change, because the test checks the status code and response body correctly, and it creates its own user. However, it does not perform a GET request after creating the article to verify that the article was actually saved. Add a GET request to confirm the article exists and its data matches what was sent. Also, use a unique article title to avoid conflicts between tests.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Check the exact status code, response body, and response structure against API.md.
2. After creating, updating, deleting, or sending a rejected request, use a GET request to verify the actual data and confirm that rejected requests do not change anything.
3. Each test must create its own user and use unique test data to avoid conflicts with other tests.
