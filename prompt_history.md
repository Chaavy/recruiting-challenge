# Prompt history — Javier Sierra

> Raw, unedited transcript. False starts and bad prompts are signal, not embarrassment.
>
> This is the one artifact where AI content is *expected* — it's the conversation transcript itself. **Do not curate, summarize, or rewrite it.** A polished prompt history with no false starts is treated as evidence of curation, which lowers your AI-discipline score.

How this file is maintained: Claude Code appends one entry per session at step 5 of the session workflow (rule in `CLAUDE.md`, "Prompt history rule"). Prompts are copied verbatim, what the model returned is summarised factually, and the accepted / rejected / refined line records only the decisions Javier took in that session. Earlier entries are never edited. Full raw transcripts of every session are kept by Claude Code at `~/.claude/projects/-Users-js-Documents-T1-exercise-recruiting-challenge/<session-id>.jsonl`.

## Tool(s) used

- [x] Claude Code
- [ ] Claude.ai
- [ ] Cursor
- [ ] Copilot
- [ ] ChatGPT
- [ ] Aider
- [ ] Other:

## How much of the work was AI-assisted

- [x] Most of it
- [ ] About half
- [ ] Less than half — used it for specific tasks
- [ ] None at all

---

## Sessions

For each session, paste the raw transcript or the prompts you sent, in order. Don't trim.

### Session 0 — scope validation (before RC-002)

Conversation held outside this repo, used as a second opinion to validate scope and prioritisation before writing `docs/personal-notes.md` (see the first paragraph of that file).

---

### Session 1 — RC-002 Claude Code integration — 2026-09-17

Session id: `e72aaca1-7f82-4a0c-b5c8-3735a340acdc`.

Note: task IDs were renamed from `RC-nnn` to `JS-nnn` during this session (prompt 5). Earlier text below keeps the old IDs on purpose; entries are not rewritten.

**Prompt 1 (verbatim, interrupted by Javier before the model answered):**
```text
I want you to read completely this file @docs/personal-notes.md to get more context about what is this project and what I am trying to achieve.  This file is defined by different points, I would like to start working on this one in particular: 2. Claude code integration

This repository is not using any AI yet, so all configurations to configure Claude Code must be done. 

As you can see in this particular point: Claude Code Notes -> This is how I will ask you to develop these tasks and feature. If you have any questions please let me know in the planning section. 

So lets get started with this task 2. Claude Integration:
```
**What the model returned:** nothing. The request was interrupted and replaced by prompt 2.
**Accepted / rejected / refined:** Javier refined the prompt into the Context / Objective / Restrictions / Edge cases / Result shape defined in his notes.

**Prompt 2 (verbatim):**
```text
I want you to read completely this file @docs/personal-notes.md to get more context about what is this project and what I am trying to achieve.  

In this specific session I would like to address this specific task 2. Claude code integration always taking as base the following steps: Claude Code Notes. Here are the details to start working on it:
Context: This project does not include any AI at the moment. I will use AI as support for the development of the tasks and the feature.
Objetive: Configure Claude Code workflow as I am proposing it - Read: 2. Claude code integration
Restrictions: As the notes says, follow them. Do not commit/push anything this is my work.
Edge cases: This is a special task - we are not fixing anything in the project yet, we are just configuring Claude Code and the workflow (tasks).
Result: I spect at the end of this task, to have Claude Code correctly configured. Tasks management system in which I can start a new session, ask for the next task, and start working on it. 

If you have any doubt please raise your hand, always remeber and it must be in the Claude.md -> You do not modify anything if is not approved by me. The very first step after I give you a prompt is -> the plan phase.
```
**What the model returned:** in plan mode, it read `docs/personal-notes.md`, the README, SUBMISSION and EVALUATION docs, all files under `src/`, `test/`, `public/` and `docs/`, ran `npm test` (2 tests passing), checked for existing Claude/git-hook config (none), and asked a Claude Code docs agent for the current settings/permissions/hooks syntax. Then it asked three questions before writing the plan:
1. Golden gate in this session: design only, or design + implement?
2. Create the 4 task files now (seeded from the notes), or only the structure + contract template?
3. Enforce "Claude cannot commit/push" with tool permissions (`.claude/settings.json` deny rules), deny all git writes, or CLAUDE.md rule only?

It then proposed a plan: `CLAUDE.md`, `.claude/settings.json` with allow/deny rules, `.gitignore` entry, `docs/tasks/` (README, INDEX, TEMPLATE, pending/, done/), a small note in `docs/architecture.md`, no changes to `src/`, `test/`, `package.json` or `docs/personal-notes.md`.
**Accepted / rejected / refined:** Javier answered: (1) "Design only" — ESLint and the pre-commit hook stay in RC-004; (2) "Structure + template only" — no task files now, they are created in RC-003 (the model had recommended creating the 4 files now; rejected); (3) "Deny commit + push" via permissions. Javier approved the plan.

**Prompt 3 (verbatim, sent as an interruption right after the model started executing the approved plan):**
```text
Before continue. I would like you to also help me to fill @prompt_history.template.md - as you can see is a file that represents the intereaction between you and me, what I wrote to you, What did you answers and also, If i did I accepted, rejected or refined. This file can be filled by AI according to repository rules so lets automate it. 
So in the steps I gave to you specific in this one: 5. update task status and index, project documentation (Claude) - please include in the project documentation this step. 

Before actually continue with the implementation for this task, review this new requirement , and give me again the plan so I can review it
```
**What the model returned:** it re-entered plan mode, read `prompt_history.template.md`, confirmed that Claude Code keeps raw JSONL transcripts on disk, and revised the plan: a "Prompt history rule" in `CLAUDE.md` and in `docs/tasks/README.md` (step 5), a fixed per-session entry format, creation of `prompt_history.md` with this session as Session 1 and a placeholder Session 0, and "What Claude got wrong" entries written only as candidates tagged `[to confirm by Javier]`. It stated one concern: evaluators read the accepted/rejected lines and the "got wrong" section as evidence of Javier's own review, so the automation records facts only and leaves confirmation to Javier.
**Accepted / rejected / refined:** Javier approved the revised plan without changes. The model then created `CLAUDE.md`, `.claude/settings.json`, `docs/tasks/{README,INDEX,TEMPLATE}.md`, `docs/tasks/pending/.gitkeep`, `docs/tasks/done/.gitkeep`, this file, appended `.claude/settings.local.json` to `.gitignore`, and added a "Development workflow" section to `docs/architecture.md`.

**Prompt 4 (verbatim):**
```text
I have already reviewed and checked all files. All are good, before acutally closing this taks I would like to spot something. This repo says that the total effort should be around 6 hours. I have already dedicated to it about 3:30. I would move the MVP, and branch strategy out of scope. Note that at the end of personal-notes.md I have a list of Post MVP that actually are the items I found but that I would not face or fix. Please include this one. Before doing any change, I will go again in plan mode for this last item. Review it.
```
**What the model returned:** no changes. A review listing the files and sections the scope change touches (`docs/personal-notes.md` Post MVP list, `CLAUDE.md` branch section, `docs/tasks/README.md`, `TEMPLATE.md`, `INDEX.md`, this file) and one open point: whether to keep the `RC-nnn` task IDs (it recommended keeping them).
**Accepted / rejected / refined:** Javier moved to plan mode for the change (prompt 5).

**Prompt 5 (verbatim):**
```text
We were in auto, i will select plan so you can give me the detailed plan
```
**What the model returned:** in plan mode it re-read the affected sections and asked two questions: (1) keep the `RC-nnn` IDs? (2) in the notes, add the Post MVP item only, or also mark the old branch lines? Then a plan: mark the four branch-strategy bullets and every `Branch:` line in the notes with "(out of scope, see Post MVP 8)" and append item 8; rewrite the branch section of `CLAUDE.md` to one working branch with `JS-nnn` commits; rename `RC-` to `JS-` in `CLAUDE.md` and `docs/tasks/`; drop the Release and Branch fields from the task template and index and add a `Commits` row; append prompts 4 and 5 here.
**Accepted / rejected / refined:** (1) Javier rejected `RC-nnn`: "Actually if you check the commit history I have already done a commit with this name: JS-001. So I would like to keep it as it is. So will be: JS-nnn." (2) "Add item + mark old lines". Javier approved the plan; the model applied it. During verification the model found that its plan had wrongly stated `docs/architecture.md` needed no change: that file still said `RC-004`; the model corrected it to `JS-004` and reported the miss.

---

## What Claude (or your AI tool) got wrong

> **Mandatory.** Three or more specific examples of AI output you rejected, corrected, or had to re-prompt. If you cannot fill this section, that itself is the signal — either nothing was reviewed, or the review left no trace. Either way, the score reflects it.
>
> For each example, fill all five fields. Vague answers ("it was wrong about the types") score lower than specific ones ("Claude proposed a `getById(id)` signature that doesn't carry the merchant context; I rejected it because the IDOR fix has to live in the DAL — see commit `abc1234`").

### Example 1 — recorded by Claude, session 1

- **The prompt:** Session 1, prompt 2 (RC-002 Claude Code integration).
- **What Claude returned:** a plan whose step 5 covered task status, index and project docs, but did not include `prompt_history.md`, even though `SUBMISSION.md` lists it as a deliverable and the notes say "update ... project documentation".
- **What was wrong with it** (technically, not just stylistically): the workflow being configured would have produced no prompt-history entries per session, so the deliverable would have had to be reconstructed by hand at the end from raw transcripts.
- **How I caught it** (what tipped you off — code reading, test failure, behavior in the browser, prior experience): Javier read the plan and interrupted execution with prompt 3.
- **What I did instead** (and where to see it in the diff, if applicable): re-plan; rule added to `CLAUDE.md` ("Prompt history rule") and `docs/tasks/README.md` ("Closing a task"); this file created.

### Example 2 — recorded by Claude, session 1

- **The prompt:** Session 1, prompt 2 (RC-002 Claude Code integration) and the plan question in prompt 5.
- **What Claude returned:** a task-ID and branch convention using the prefix `RC-nnn` (Recruiting Challenge), taken from the branch names in `docs/personal-notes.md`, and it recommended keeping that prefix in the plan question.
- **What was wrong with it:** the repo's commit history already set the convention: the first commit is `JS-001`. Claude read the notes but did not check `git log` for an existing ID convention, so the task system, `CLAUDE.md` and the template would have used an ID that did not match the commits `signoff.md` has to reference.
- **How I caught it:** Javier answered the plan question from memory of his own commit history.
- **What I did instead:** IDs renamed to `JS-nnn` in `CLAUDE.md`, `docs/tasks/README.md`, `TEMPLATE.md`, `INDEX.md`; earlier prompt-history text keeps `RC-` as written.

### Example 3

- **The prompt:**
- **What Claude returned:**
- **What was wrong with it:**
- **How I caught it:**
- **What I did instead:**
