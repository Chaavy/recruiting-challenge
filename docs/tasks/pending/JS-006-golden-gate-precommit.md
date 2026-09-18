# JS-006 — Golden gate: pre-commit hook and regression over JS-004 / JS-005

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | pending                                |
| Type     | bugfix                                 |
| Priority | 3                                      |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

The golden gate (definition of done) is written in `CLAUDE.md` and `docs/architecture.md` but nothing enforces it: until now Claude runs the checks by hand and reports the output. Javier's original plan put this task first; in the JS-003 session (2026-09-18) he moved it to third place because he has configured CI before and it can take longer than expected, and he wants the two fixes landed first. This task then doubles as the regression run over JS-004 and JS-005.

Decisions from Javier's notes: the hook runs `tsc` and `npm test`; the test glob in `package.json` is fixed; ESLint is Post MVP (new dependencies, possible new vulnerabilities, no time); GitHub Actions is Post MVP.

## What is wrong / what is missing

1. No pre-commit hook exists. A commit that breaks tests or types is possible for both Javier and Claude (Claude is denied `git commit` in `.claude/settings.json`, Javier is not blocked by anything).
2. `package.json` `test` script uses an unquoted glob `test/**/*.test.ts`. npm runs scripts with `sh`; if a subfolder appears under `test/`, `sh` expands `**` as `*` and drops the top-level test files silently. It works today only because there are no subfolders, so `sh` passes the literal to Node, which expands it itself (Node >= 21).
3. `node --test` exits non-zero on failures but not on skipped or todo tests. The gate requires 0 skipped, 0 todo, 0 cancelled.
4. `tsc --noEmit` is not run anywhere; `npm run build` exists but is not part of any check.
5. The gate text in `CLAUDE.md` (line 89-91) lists ESLint. With ESLint in Post MVP, `CLAUDE.md` needs Javier's own edit to match (Claude does not edit `CLAUDE.md` without explicit approval; see Restrictions).

## Objective (what I propose)

Add a versioned hook directory `.githooks/` with a `pre-commit` script that runs `npm run check`; `check` = `tsc --noEmit` then the test suite, failing on any failure, skip, todo or cancelled test. Wire it with an npm `prepare` script that sets `git config core.hooksPath .githooks` on `npm install`, so no dependency (no husky) is needed. Quote the test glob. Then run the complete gate against the current tree (JS-004 and JS-005 work) and paste the raw output in this task's session log. After this task no `git commit` on this machine succeeds with red types or tests unless `--no-verify` is used, and that bypass is documented.

## Scope

- In:
  - `.githooks/pre-commit` (POSIX `sh`, executable): runs `npm run check`, exits with its status, prints a one-line hint about `--no-verify`.
  - `scripts/golden-gate.sh` (or inline in `package.json` if it stays one line): runs `tsc --noEmit`, then `npm test` capturing output, greps the `node --test` summary lines (`fail`, `skipped`, `todo`, `cancelled`) and fails if any is non-zero; prints the raw test output.
  - `package.json`: `"check"` script, `"prepare": "git config core.hooksPath .githooks"`, test glob quoted `'test/**/*.test.ts'`.
  - README: "Golden gate" section: what runs, how the hook is installed, the `--no-verify` bypass and that it must not be used for task commits.
  - `docs/architecture.md`: development workflow paragraph updated (hook implemented, ESLint pending).
  - Regression: full `npm run check` over the tree after JS-004 and JS-005; raw output in the session log.
- Out (explicitly not touched, even if tempting):
  - ESLint and any lint dependency. Post MVP (Javier, 2026-09-18). `npm run lint` keeps not existing.
  - GitHub Actions or any server-side CI. Post MVP.
  - Code scanners, coverage thresholds.
  - Moving tests into subfolders (allowed after the glob fix, but not done here).
  - Type-checking `test/` (tsconfig `include` is `src/**/*`; widening it is a separate decision).

## Restrictions

- No new dependencies. Shell + npm scripts only.
- `prepare` must be harmless outside a git checkout (e.g. `git config ... || true` is not acceptable if it hides real errors; guard with `git rev-parse --is-inside-work-tree` instead).
- The hook must run the whole suite, not only staged files. Suite is small; correctness over speed.
- Claude does not edit `CLAUDE.md`. If Javier wants the ESLint bullet in the golden gate rewritten to "ESLint: Post MVP", he edits it or approves the exact line in the plan phase.
- No `src/` change is expected. If one becomes necessary to make `tsc --noEmit` pass, it ships with its own test as usual and is listed in the session log.

## Edge cases

- A test marked `{ skip: true }` or `{ todo: true }` → gate fails even though `node --test` exits 0. Verified manually during the task by adding and removing a temporary skipped test (not committed).
- A type error in `src/` → gate fails before tests run.
- Fresh clone: `npm install` installs the hook via `prepare`; document that `core.hooksPath` is per-clone.
- `git commit --no-verify` → bypasses; documented as the only bypass and recorded in signoff if ever used.
- `npm install` on a machine without `git` → `prepare` skips with a message, no failure.

## Expected result

- `git commit` with a failing test or type error is rejected with the raw `check` output on screen.
- `git commit` with a green tree proceeds.
- `npm run check` prints `tsc` result and the `node --test` summary with `fail 0`, `skipped 0`, `todo 0`, `cancelled 0`.
- `git config core.hooksPath` prints `.githooks` after `npm install`.
- Session log of this task contains the raw regression output over JS-004 + JS-005.

## Acceptance criteria

- [ ] `npm run check` exits 1 when a test fails (verified by a temporary failing test, not committed).
- [ ] `npm run check` exits 1 when a test is skipped or todo (verified the same way).
- [ ] `npm run check` exits 1 on a type error in `src/` (verified with a temporary error, not committed).
- [ ] `npm run check` exits 0 on the current tree; raw output pasted in the session log.
- [ ] `.githooks/pre-commit` is executable and calls `npm run check`.
- [ ] `git config core.hooksPath` = `.githooks` after `npm install`.
- [ ] Test glob is quoted in `package.json`.
- [ ] README documents the gate and the bypass.

## Validation

- Tests to add (file names and what each asserts): none under `test/` (no `src/` change). The hook itself is validated by the three temporary-break checks above, each documented in the session log with its output.
- Commands to run: `npm run check`, `npm test`, `git config core.hooksPath`, then one real `git commit` attempt by Javier with a deliberately broken test to see the rejection (Javier runs git).
- What to click or call in the dashboard / API to see it working: not applicable.

## Confidence and falsification

- Confidence (1–10): 8 [proposed by Claude, Javier confirms]. Javier's own confidence on the original item was 9; the uncertainty about blocking human commits was resolved in JS-003 (a pre-commit hook blocks everyone; `--no-verify` is the only bypass).
- How to know if I am wrong (a specific scenario that would prove the change wrong): `tsc --noEmit` fails on the current tree for a reason unrelated to the tasks (then the gate blocks all commits until fixed and this task grows); or the `node --test` summary format changes with a Node upgrade and the grep passes silently on a skipped test (mitigation: the grep must fail closed when the summary lines are missing).

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session. Javier's decisions: order moved from first to third; hook runs `tsc` + `npm test`; glob quoted; ESLint and GitHub Actions to Post MVP. No work started.
