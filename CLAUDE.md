# CLAUDE.md — project rules for Claude Code

Owner: Javier Sierra. This file is the contract between Javier and Claude Code for this repo.
Claude does not edit this file, anything under `.claude/`, or `docs/personal-notes.md` without explicit approval.

## Project

Small merchant sales dashboard (T1 recruiting challenge). A static page in `public/` calls an Express API in `src/` that reads a SQLite database. The merchant is chosen by the `X-Merchant-Id` header. Frontiers identified so far: Merchant, Orders, Metrics, Revenue, Analytics (not implemented), Auditlog (not implemented).

Read before touching code: `docs/architecture.md`, `docs/api.md`, `docs/personal-notes.md` (Javier's plan, priorities and branch strategy; read-only for Claude).

Task state (auto-loaded every session):
@docs/tasks/INDEX.md

## Stack and commands

- Node >= 20 (local: 24), TypeScript strict with `noUncheckedIndexedAccess`, ESM (`"type": "module"`; relative imports end in `.js`).
- Express 4, better-sqlite3, `node:test` + `node:assert/strict`. No framework on the frontend.
- `npm install` — deps. `npm run dev` — server with reload at http://localhost:3000 (`PORT=3055 npm run dev` to change port).
- `npm start` — server without reload. `npm run seed` — seeds 2 merchants and 80 orders if the DB is empty.
- `npm test` — runs `test/**/*.test.ts` against an in-memory DB (`DB_PATH=:memory:`).
- `npm run build` — `tsc` to `dist/`.
- `npm run lint` — does not exist yet. It is created in task JS-006 (golden gate).
- DB file: `data/dashboard.db` (gitignored). The server seeds it on first start. Deleting it reseeds; ask before deleting.

## Code rules

- All order queries go through `src/dal/orders-dal.ts` (`ordersDal`). Do not open new DB connections in routes.
- Amounts are integer cents. Never store or compute money as floats.
- SQL is always parameterized (`?` placeholders). No string interpolation into queries.
- Errors returned to clients are generic codes (`{ error: 'not_found' }`), never stack traces or internal detail.
- Every change under `src/` ships with its own unit test under `test/`, same naming (`<module>.test.ts`).
- No new or upgraded dependencies without Javier's approval in the plan.
- Keep changes inside the scope of the current task. Report anything else you notice; do not fix it.

## Branch and commit conventions

- One working branch: `feature/javier-sierra-challenge`. No release or per-task branches (see Post MVP item 8 in `docs/personal-notes.md`).
- One or more commits per task, made by Javier. Commit messages are human-written (challenge rule) and start with the task ID `JS-nnn`, as in the existing commit `JS-001`.
- Claude never runs `git commit`, `git push`, `git merge`, `git rebase` or `git reset`. These are denied in `.claude/settings.json`.

## Session workflow (mandatory)

1. **Prompt** (Javier): Context, Objective, Restrictions, Edge cases (if any), Expected result.
2. **Plan** (Claude proposes, Javier validates): the first response to any prompt is a plan. Claude modifies no file until Javier writes an explicit approval. Questions are raised in this phase, not during execution.
3. **Execution** (Claude): only what the approved plan says.
4. **Tests** (Claude codes and runs; Javier reviews line by line): unit tests for every `src/` change, `npm test`, lint (once JS-006 exists). The golden gate below must be green.
5. **Update** (Claude): task status and index, project docs, `prompt_history.md`. See "Closing a task".
6. **Commit and push** (Javier).

### Asking for the next task

When Javier asks for "the next task": read `docs/tasks/INDEX.md`, take the first row with status `pending` (rows are in priority order), read its file in `docs/tasks/pending/`, set its status to `in-progress` only after the plan is approved, and start step 2 using the task file as the prompt. If there is no pending task, say so and stop.

### Closing a task (step 5)

- Set `Status: done` in the task file and append a dated entry to its "Session log" (decisions taken, where Javier disagreed with Claude).
- Move the file from `docs/tasks/pending/` to `docs/tasks/done/` and update `docs/tasks/INDEX.md`.
- Update the docs the change affects: `docs/api.md`, `docs/architecture.md`, README if commands changed.
- Append the session entry to `prompt_history.md` (rule below).

### Prompt history rule

`prompt_history.md` (repo root) is a submission deliverable and must stay raw. At step 5 of every session Claude appends one entry under `## Sessions`:

- Every prompt Javier wrote, verbatim and in order, including interrupted prompts and corrections.
- One short factual summary of what Claude returned per prompt (no polish, no marketing).
- "Accepted / rejected / refined": only the decisions Javier actually took in the session, quoting his words when possible.
- Never edit, reorder or polish earlier entries.
- When Javier rejected or corrected Claude's output, add a candidate under "What Claude got wrong" with the five template fields, tagged `[to confirm by Javier]`. If there is nothing to add, add nothing.
- If a session ends before step 5, the next session records it as "entry reconstructed, see raw transcript".

Raw transcripts of every session are stored by Claude Code at
`~/.claude/projects/-Users-js-Documents-T1-exercise-recruiting-challenge/<session-id>.jsonl`.

Entry format:

```markdown
### Session N — JS-nnn <topic> — YYYY-MM-DD

**Prompt 1 (verbatim):**
<fenced block with the prompt>
**What the model returned:** one to three factual sentences.
**Accepted / rejected / refined:** decisions Javier took, as they happened.
```

## Golden gate (definition of done)

Designed in JS-002, enforced by ESLint config + pre-commit hook in JS-006. Until then Claude checks it by hand and reports the output.

- ESLint: zero errors and zero warnings.
- `npm test`: every test passed. 0 failed, 0 skipped, 0 todo, 0 cancelled.
- Every `src/` change has a unit test that encodes the business rule it touches.
- Docs updated for anything the change affects.
- Javier has reviewed the diff and the test output line by line.
- If any point fails, the work is not done and must not be committed.

## What Claude must not do without explicit approval

- Any git write: commit, push, merge, rebase, reset, branch creation, checkout, stash, tag.
- Edit `docs/personal-notes.md`.
- Edit or draft any human-written deliverable: `decision_log.md`, `validation_design.md`, `signoff.md`, `written_answers.md`, commit messages. Claude may point to facts (task session logs, prompt history) that Javier uses to write them.
- Add, remove or upgrade dependencies.
- Delete `data/*.db` or any file outside the approved plan.
- Edit `CLAUDE.md` or `.claude/`.
