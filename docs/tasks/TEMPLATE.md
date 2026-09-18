# JS-nnn — <title>

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | pending / in-progress / done           |
| Type     | bugfix / feature                       |
| Priority | n (1 = first)                          |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

What part of the system this touches, which frontier(s), and what the reader needs to know before the objective makes sense.

## What is wrong / what is missing

The problem as observed. Point to files and lines. For a feature: the gap.

## Objective (what I propose)

The change in one paragraph. What the system does after this task that it did not do before.

## Scope

- In:
- Out (explicitly not touched, even if tempting):

## Restrictions

Rules for this task on top of `CLAUDE.md` (files not to touch, dependencies not to add, patterns to keep).

## Edge cases

Inputs, states or failures the change must handle. Each one should end up in a test.

## Expected result

What Javier will see when the task is done: endpoints, UI behaviour, files, command output.

## Acceptance criteria

- [ ] Each item maps to a unit test or a visible behaviour.
- [ ]

## Validation

- Tests to add (file names and what each asserts):
- Commands to run: `npm test`, lint
- What to click or call in the dashboard / API to see it working:

## Confidence and falsification

- Confidence (1–10):
- How to know if I am wrong (a specific scenario that would prove the change wrong):

## Session log

Filled during the session(s). One dated entry per session: decisions taken, alternatives rejected, where Javier disagreed with Claude and what was done instead.

- YYYY-MM-DD —
