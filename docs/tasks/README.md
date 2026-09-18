# Task system

Every piece of work in this repo is a task with its own file. The task file is the contract: it is written before any code, it is the prompt Claude receives, and it records what was decided while the work happened.

## Layout

```
docs/tasks/
  README.md      this file
  INDEX.md       priority-ordered list of all tasks and their status
  TEMPLATE.md    the contract every task file follows
  pending/       tasks not finished (status pending or in-progress)
  done/          finished tasks
```

## IDs and types

- ID: `JS-nnn`, sequential, never reused, same prefix as the commit messages (first one: `JS-001`). JS-001 to JS-003 are the meta steps in `docs/personal-notes.md` and are not tracked here.
- Type: `bugfix` or `feature`.
- File name: `JS-nnn-<slug>.md`.
- No per-task branches: all work goes to `feature/javier-sierra-challenge` (see Post MVP item 8 in the notes).

## Lifecycle

| Status        | Meaning                                        | Folder     |
|---------------|------------------------------------------------|------------|
| `pending`     | contract written and approved, no work started | `pending/` |
| `in-progress` | plan approved in a session, work under way     | `pending/` |
| `done`        | golden gate green, docs updated, ready to commit | `done/`  |

Rows in `INDEX.md` are in execution order. The "next task" is always the first row with status `pending`.

## Creating a task

Copy `TEMPLATE.md` into `pending/JS-nnn-<slug>.md`, fill every section (write `TBD` rather than leaving a section empty), add a row to `INDEX.md`. Javier reviews and approves the contract before it becomes `pending`.

## Working a task

1. In a new Claude Code session, ask for the next task (or name one: "work on JS-004").
2. Claude reads the task file and answers with a plan. Nothing is modified until Javier approves.
3. Claude executes, writes the tests, runs `npm test` and lint, and reports the raw output.
4. Javier reviews the diff and the test output line by line.

## Closing a task (step 5 of the session workflow)

Done by Claude, reviewed by Javier:

- [ ] Golden gate green (see `CLAUDE.md`).
- [ ] Task file: `Status: done`, dated entry in "Session log" (decisions, disagreements).
- [ ] Task file moved from `pending/` to `done/`.
- [ ] `INDEX.md` row updated.
- [ ] Project docs updated (`docs/api.md`, `docs/architecture.md`, README if commands changed).
- [ ] Session entry appended to `prompt_history.md` (rule in `CLAUDE.md`).
- [ ] Task file: `Commits` row filled with the short SHAs once Javier has committed.
- [ ] Javier commits on `feature/javier-sierra-challenge` with `JS-nnn` at the start of the message, and pushes.
