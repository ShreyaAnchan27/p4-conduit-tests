# Tests from Playwright's agents, and my review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Date: 2026-11-19

## 1. How I set up the agents
- **Command:** `npx playwright init-agents --loop=claude` (TESTS terminal, in `P4`)
- **What it made:** `.claude/agents/playwright-test-planner.md`, `.claude/agents/playwright-test-generator.md`, `.claude/agents/playwright-test-healer.md`, `.mcp.json`, `specs/README.md`, `tests/seed.spec.ts`
- **Browser hidden:** `"--headless"` added to `P4/.mcp.json`: yes
- **Where I started Claude for the agents:** in `P4`, because Claude finds the agents and their browser only there

## 2. What I asked the agents
- **Area:** the profile page and following an author
- **My prompt** (`P4/prompts/agents.md`):
  - Task: First use the playwright-test-planner agent to plan tests for the profile page and following an author. Save the plan as specs/profile-follow.md. Then use the playwright-test-generator agent to write one test for each scenario in the plan, in the folder tests/profile-follow/.
  - Material: Start on the page /profile/practice-author. For steps that need a signed-in user, use a practice user from README.md.
  - Rules: Plan at most 2 short scenarios, with at most 5 steps each. Do not change any other test file. Do not run the test suite. Each test must verify the actual result in the UI, not just that an action was successful or a confirmation message appeared.
- **The plan the planner saved:** `specs/profile-follow.md` (2 scenarios)
- **The test files the generator wrote:** `tests/profile-follow/signed-out-profile.spec.ts`, `tests/profile-follow/follow-author.spec.ts`
- `tests/seed.spec.ts` is the agents' start file. It checks nothing about the app, so it is not reviewed here.

## 3. My review of every generated test
- **The teammate's question:** "Claude says that at the end, practice-reader follows practice-author again. So we can keep this test in our suite as it is, right?"
- **My answer:** Not necessarily. The test assumes the user already follows the author, so its result depends on the initial state. We should reset the state before running it to make the test reliable.
- "Signed-in reader unfollows and follows an author, and the state survives a reload" · **changed**, because the test checks useful follow/unfollow behaviour, but it uses a shared practice user. It should create its own user by API to avoid depending on shared or leftover data.
- "Signed-out visitor sees the profile without a follow button" · **changed**, because the test checks useful signed-out profile behaviour and uses good user-facing locators. But it relies on the shared practice-author user. It should create its own author by API to avoid shared test data.

## 4. What I asked Claude to change, and the result
- **My change** (the Changes line of `P4/prompts/stronger.md`): In @P4/tests/profile-follow/follow-author.spec.ts: The test checks useful follow/unfollow behaviour, but it uses a shared practice user. It should create its own user by API to avoid depending on shared or leftover data. In @P4/tests/profile-follow/signed-out-profile.spec.ts: The test checks useful signed-out profile behaviour and uses good user-facing locators. But it relies on the shared practice-author user. It should create its own author by API to avoid shared test data.
- **Result:** No fault: 27 passed, 0 failed (my second fault run)
