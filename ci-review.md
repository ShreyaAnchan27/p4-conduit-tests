# My CI workflow and review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

Repository: the P4 folder · Workflow: `.github/workflows/playwright.yml` · Date: 2026-11-20

## 1. What my project needs
- **Node.js on my laptop (`node -v`):** v24.22.1
- **My whole suite on my laptop:** `npx playwright test` → 27 passed, 0 failed
- **What the GitHub computer needs (my words):**
  - Node.js: Node.js 24.22.1 (same as my laptop), since the project requires Node.js 22.13 or newer.
  - Packages: npm ci — it installs the exact package versions from package-lock.json.
  - Browser: Chromium only (from the example)

## 2. My prompt to Claude
```text
Task: Write a GitHub Actions workflow that runs this Playwright suite on every push and keeps the HTML report. My GitHub repository is the P4 folder, so save it as P4/.github/workflows/playwright.yml. After the file, write one line for each step: what it does.
Material: @P4/package.json @P4/playwright.config.ts @P4/README.md
Rules: Use actions/checkout@v6, actions/setup-node@v6 and actions/upload-artifact@v6. Do not run anything. Do not commit or push. Use Node.js 24.22.1, install packages with npm ci, and install only Chromium because that is the browser used by my Playwright config.
```

## 3. What Claude's workflow got wrong for my project
- **Claude's workflow:** my rule gave the version, so my workflow already had `node-version: 24.22.1`. In another run with no version rule, Claude wrote `node-version: 22`.
- **Claude said:** (in that other run) "ASSUMPTION: `node-version: 22` gets the newest Node 22, which is 22.13 or later. You could use 24 instead. Nothing in the material asks for a specific version."
- **My project needs:** Node.js 24.22.1 (same as my laptop), since the project requires Node.js 22.13 or newer.
- **My answer to the developer:** Not yet. Node.js 22 meets the minimum requirement, but our laptop uses 24.22.1. To keep CI consistent with our local setup, let's use 24.22.1 instead.
- **My line to Claude:** In @P4/.github/workflows/playwright.yml, add a comment above line 17 explaining why we use Node.js 24.22.1. My laptop runs Node.js v24.22.1, and our tests passed with it (27 passed, 0 failed). Change nothing else. Do not run anything.

## 4. My reading of the workflow
- **When, where, the code and Node.js (lines 1–18):**
  - Line 1: Names the workflow "Playwright tests".
  - Line 3–4: Runs the workflow whenever someone pushes code.
  - Line 6–7: Defines a job called test.
  - Line 8: Runs the job on a fresh Ubuntu Linux computer.
  - Line 9: Stops the job if it takes more than 30 minutes.
  - Line 10: Starts the list of steps.
  - Line 11–12: Checks out (copies) the repository onto the GitHub computer.
  - Line 14–18: Installs Node.js 24.22.1, the same version used on my laptop.
- **Packages, browser, tests and the report (lines 19–36):**
  - Line 19: Caches npm packages to make future runs faster.
  - Lines 21–22: Installs the exact project dependencies using npm ci.
  - Lines 24–25: Installs Chromium and its required system dependencies.
  - Lines 27–28: Runs the Playwright test suite.
  - Lines 30–31: Uploads the HTML test report to GitHub.
  - Line 32: Uploads the report even if tests fail, as long as the workflow wasn't cancelled.
  - Lines 33–34: Names the saved report playwright-report.
  - Line 35: Specifies the folder containing the HTML report.
  - Line 36: Keeps the report for 30 days.

## 5. The first run on GitHub
- **Run:** Add the CI workflow · **Result:** … · **Tests:** …
- **The report (artifact):** …

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** …
- **What GitHub showed:** …

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** …

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- "…": **kept / changed / removed**, because …

### Tuesday: `tests/contract.spec.ts`
- "…": **kept / changed / removed**, because …
