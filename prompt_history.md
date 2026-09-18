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

### Session 2 — JS-003 architecture review and tasks final definition — 2026-09-18

Session id: `c9c48822-4fb8-46ba-a62e-2cd24be43f40`. Prompt 1 was sent late on 2026-09-17; the rest on 2026-09-18.

**Prompt 1 (verbatim):**
```text
next task
```
**What the model returned:** read `docs/tasks/INDEX.md` and `docs/tasks/pending/`, found no task defined, listed the four candidates from the notes and stopped, as `CLAUDE.md` requires.
**Accepted / rejected / refined:** none; Javier confirmed the workflow behaved as expected ("The system is working as expected") and moved to JS-003.

**Prompt 2 (verbatim):**
```text
The system is working as expected, now I can ask you about next tasks - our contracts. And start working on them - validation complete.

Lets start working on JS-003.

As I defined in @docs/personal-notes.md  (3. Plan validation - supported by Claude Code as secondary opinion) our next task that is not defined in tasks folder (This has a reason to be -> This challenge ask us to fix 3 problems I have already spotted and also to develop 1 feature that I have already selected) So this JS-003 is an architecture session to discuss these tasks findings.

Context:  I want you to act as a Senior Architect in this session. As defined in JS-003, is a discussion session, no changes. I have specified the tasks I want you to implement based on priority, this priority has changed according to this:
1. revenue frontier fix
2. Security - I will adjuts the scope - there are 3 tasks inside of this, we will just fix the very first one (SQL injection) the others must be moved to out of scope - and added to Post MVP
3. CI rules
I have decided to move the order of 1 and 3 because the time I have already spent on the solution. I have configued CI before (in other projects) and it could take more time than the expected. So I would like to address the 2 other findings first. In task number 3 we should do a regression test to check that task 1 and task 2 have successfully accomplished quality gates - golden gate
Objective: After the discussion we will have, I will take notes and final decisions to implement JS-004.
Restrictions: Do not edit any file. this is a discussion session.
Expected: tell me if I am missing something so I can check and review, if there is an specific scenario in which something will go wrong (each task has a How to know if I am wrong), and If the order I proposed is not the correct, I would like to know your thoughts.

Feature B — Order-event webhooks
This feature on my personal notes has not any information related about how we will build this feature - I was waiting this session to discuss it with an Architect.

1. Events - The system currently does not have the ability to check if an order was created, refunded or if it status has changed. That is what I have know based on the codebase check I did, before going forward with this, I would like you to check the codebase and sport if there is an existing feature for any of these 3 type of events, if there exist we will start working based on it, if not we will develop a very first feature for creating an order and telling the Client URL that this happend. When the feature of creating an order is avaibale in our system, we will just connect it to it and do a complete regression test. 
2. Payload - In order to send the necessary information to the client. we must defined the Payload body here is what I have on mind: UUID eventId, String eventType, int merchantId, Order orderDetails (int id, String customerEmail, int totalAmount, String type, String status, Timestamp createdAt)
3. Delivery guarantee: at-least-once + idempotency - to prevent duplicates. We must save this event on Database, so if our service crashes or is down - we can continue. This will be a Job - checking against our database - We have to define a specific Table where it has the necessary to produce the request: UUID eventId, String eventType, int merchantId, Order orderDetails (int id, String customerEmail, int totalAmount, String type, String status, Timestamp createdAt) same as what the payload sends in step 2.
4. Retry policy: retry 3 times + backoff (5 min, 15 min, 30 min). After 3 retries, if no one was successful we will just mark the event as Failed. For out of scope - implement a DLQ for this escenario. 
5. Authentication - private and public key - each payload sent to the client is signed with the key. Client has the key to check if the payload is from a valid source. This is with I have worked mostly, but I understand there exists more mechanism for this type of escenario, you can propose them. 
6. Subscription management. We should implement at least 3 endpoints - no frontend yet just APIs -> out of scope for this feature. An endpoint that will allow to create the URL based on the merchantId, and another endpoint to delete it and a 3rd endpoint to consult the subscription.
```
(IDE selection at the time: `docs/personal-notes.md` line 89, "How to know if I am wrong:".)
**What the model returned:** read every file in `src/`, `test/`, `public/` and the challenge docs, ran `npm test` (2 pass) and `npm audit` (4 vulnerabilities), edited nothing in the repo (a plan-mode note file was written outside the repo under `~/.claude/plans/`). Findings: (1) revenue adds refunds (`sumAmountByMerchant` ignores `type`/`status`), the `to` boundary excludes today's orders, mixed `created_at` formats, float `revenue` field; metrics bypasses the DAL with a second connection and is untestable under `:memory:`. (2) No SQL injection exists: every query is parameterized; the real issues are cross-tenant `getById`, unvalidated `POST /api/orders` input, an error `detail` leak, and the audited dependencies. (3) CI: a pre-commit hook blocks humans too, `--no-verify` is the bypass, ESLint needs new devDependencies, unquoted test glob, `tsc --noEmit` is a free gate. (4) Webhooks: no event mechanism exists; proposed transactional outbox, two tables, snake_case payload with TEXT ids, injected clock/fetch dispatcher, HMAC-SHA256 instead of asymmetric keys, SSRF protection (not in Javier's list), three merchant-scoped endpoints, and slicing so any stop is deliverable. Agreed with the proposed order; estimated the remaining work exceeds the 6-hour budget.
**Accepted / rejected / refined:** recorded by Javier in `docs/personal-notes.md` "Notes after discussion": SQL injection finding withdrawn ("IA was correct, there is not any SQL injection I was confused - expecting to see :param as JPA"); tenant isolation + POST validation accepted; dependencies and custom errors to Post MVP; revenue calculation accepted as P0; timestamps and float money to Post MVP; hook with `tsc` + `npm test` + glob fix accepted, GitHub Actions to Post MVP; all webhook proposals accepted including HMAC and SSRF prevention; webhooks in small deliverables.

**Prompt 3 (verbatim):**
```text
I have added my personal notes into @docs/personal-notes.md based on this discussion. Based on that I would like you to start with the next task: 4. Project tasks final definition in which you will create each task in our tasks folder with its specification based on this last session and the decisions I made on my personal notes.
```
**What the model returned:** a plan: seven contracts in `docs/tasks/pending/` (revenue+metrics, tenant isolation+validation, golden gate, four webhook slices), rewrite `INDEX.md`, append this entry; no edits to `CLAUDE.md`, `.claude/`, personal notes or code. Four questions: (1) task IDs by execution order (JS-004 revenue … JS-006 golden gate) requiring an ID edit in `CLAUDE.md`/`architecture.md`, or keep JS-004 for the gate; (2) one webhook task file or four; (3) include the `to` boundary fix in the revenue task; (4) include ESLint in the gate task (two new devDependencies), recommended yes.
**Accepted / rejected / refined:** see prompt 4.

**Prompt 4 (verbatim):**
```text
1. Option A
2. Yes I understand the time is a important factor in here yes, four files please.
3. Include it - small change - production users will be graceful. 
4. Eslint add new dependencies which means possible new vulnerabilities could be found - due to the time i have, please move it to post mvp

Plan approved, continue
```
**What the model returned:** created `JS-004` … `JS-010` contracts, rewrote `docs/tasks/INDEX.md`, changed the golden-gate task ID from JS-004 to JS-006 in `CLAUDE.md` (three lines) and `docs/architecture.md` (one line). The auto-mode classifier denied `sed` on `CLAUDE.md` and a `npx tsc --noEmit` baseline check; the ID edits were then applied with the editor tool under Javier's explicit approval, the type-check baseline was not run. Reported that `CLAUDE.md` still lists ESLint in the golden gate and needs Javier's own edit now that ESLint is Post MVP.
**Accepted / rejected / refined:** Javier chose Option A, four webhook files, the `to` fix in scope, and rejected ESLint in JS-006 ("Eslint add new dependencies which means possible new vulnerabilities could be found - due to the time i have, please move it to post mvp").

### Session 3 — JS-004 Revenue and Metrics frontier fix — 2026-09-18

Session id: `c9c48822-4fb8-46ba-a62e-2cd24be43f40` (same Claude Code session as Session 2, continued after Javier committed JS-003).

**Prompt 1 (verbatim):**
```text
next task
```
**What the model returned:** took JS-004 (first `pending` row), confirmed the tree was clean after commit `29d2bd2`, and answered with a plan: `src/lib/date-range.ts` helper, `revenueByMerchant` replacing `sumAmountByMerchant`, `summaryByMerchant` + `topCustomers` in the DAL, `metrics.ts` without its own connection, flat test files, docs, and five decisions to take: (1) one constant SQL fragment for the signed amount despite the "no interpolation" rule; (2) `order_count` all rows vs completed only; (3) remove `sumAmountByMerchant`; (4) one or two commits; (5) permission to run `npx tsc --noEmit` after the classifier denied it in Session 2.
**Accepted / rejected / refined:** see prompt 2.

**Prompt 2 (verbatim):**
```text
1. I accept the one module-level consant string. As you said, it is not user input is a rule we can define in code and accept it as good case.
2. all rows
3. I have already checked and yes no other uses, remove it.
4. Two different tests, two different commits.
5. I give you the permission to execute it by your self

approved
```
**What the model returned:** step A only (so commit A could be made alone): task set `in-progress`; DAL constant `SIGNED_COMPLETED_AMOUNT_SQL`, `summaryByMerchant`, `topCustomers`; `metrics.ts` rewritten through the DAL; `test/orders-dal.test.ts` (12) and `test/metrics.test.ts` (5); api.md metrics fields; architecture.md DAL paragraph. First run: 1 failing test caused by the model's own fixture (a tie on `total_spent` between two customers, ordered arbitrarily by SQL); the model changed the fixture and added an `ORDER BY … customer_email ASC` tie-breaker with its own test, and reported this as a change beyond the plan. `tsc` exit 0, 19 tests pass. Stopped and asked Javier to commit A.
**Accepted / rejected / refined:** Javier reviewed and committed A as `f7e813b` ("I review the changes made, run the commands to validate the changes, and added comments to personal notes of what I checked and what I did not check"). No objection to the tie-breaker.

**Prompt 3 (verbatim):**
```text
Commit A done, continue
```
**What the model returned:** step B: `src/lib/date-range.ts` (`toExclusiveUpperBound`), `revenueByMerchant` with the shared fragment and `status = 'completed'`, `sumAmountByMerchant` removed, `revenue.ts` updated, `test/date-range.test.ts` (5), 10 revenue cases in `test/orders-dal.test.ts` including the SQLite `CURRENT_TIMESTAMP` format, `test/revenue.test.ts` (4); api.md revenue section and architecture.md `lib/` entry. Gate by hand: `tsc` exit 0; 38 tests, 38 pass, 0 fail/skipped/todo/cancelled. Live check on port 3055 against the seeded DB: `m_acme` revenue 2026-08-19..2026-09-18 = 80940 cents, equal to a direct SQL cross-check; the old formula on the same data gave 148648 (refunds added, today excluded). Task closed: status `done`, session log, moved to `docs/tasks/done/`, INDEX updated, this entry.
**Accepted / rejected / refined:** pending Javier's line-by-line review and commit B; the `Commits` row of the task file still needs B's SHA.

### Session 4 — JS-005 Tenant isolation and order input validation — 2026-09-18

Session id: `c9c48822-4fb8-46ba-a62e-2cd24be43f40` (same Claude Code session, continued after Javier committed JS-004 B as `3ba0151`).

**Prompt 1 (verbatim):**
```text
next task
```
**What the model returned:** took JS-005, and a plan in two commits: A `getById(merchantId, id)` with 404 for cross-merchant reads, B a pure validator in `src/lib/validate-order.ts` used by POST. Three questions: trim the email or only reject blanks; approve the forced one-argument edit of the existing test; confirm the unknown-merchant 500 stays out. Also proposed filling JS-004's B SHA.
**Accepted / rejected / refined:** see prompt 2.

**Prompt 2 (verbatim):**
```text
1. Reject blank ones.
2. Yes I approve the change
3. stays out - we will only do what is defined in the spec

approved
```
**What the model returned:** step A: DAL, route, existing test updated, 4 DAL tests and 4 route tests, api.md; JS-004 `Commits` row filled; task `in-progress`. `tsc` exit 0, 46 tests pass. Stopped for commit A.
**Accepted / rejected / refined:** Javier did not commit yet; he asked to verify the behaviour himself first (prompt 3).

**Prompt 3 (verbatim):**
```text
I would like to test by my self the 404. give me the prompt to test it by terminal. I have the service running
```
**What the model returned:** five `curl` steps: capture one order id per merchant, owner 200, other merchant 404, missing id 404 with the same body, and the reverse direction; plus a note that `npm start` does not reload and that comparing with the old behaviour needs `git stash`, which is Javier's to run.
**Accepted / rejected / refined:** Javier ran the checks and committed A as `e9f003b` ("tenants issue fixed with AND, now tenants get 404 if they try to read orders from ot…").

**Prompt 4 (verbatim):**
```text
continue with B
```
**What the model returned:** step B: `validateCreateOrderBody`, POST route using it, `test/validate-order.test.ts` (29), 17 POST route tests, api.md and architecture.md. `tsc` exit 0; 92 tests, 92 pass, 0 fail/skipped/todo/cancelled. Task closed: status `done`, session log, moved to `docs/tasks/done/`, INDEX, this entry.
**Accepted / rejected / refined:** pending Javier's line-by-line review and commit B; the `Commits` row still needs B's SHA.

**Prompt 5 (verbatim, sent in plan mode after reviewing step B):**
```text
I will go in plan mode to accept changes before executing.

One thing I am going to reject -> type is absent -> default to sale. I think this must be an existing value in the request, we only accept sale or refund and is case-sensitive - this validation is good for me. I will take this decision because we are creating an Order - we must know if it is sale or refund and do not decide by default.

After that, we also need to update the tests accordingly. As a check, just validate that not frontend is broken with this change, I validate in the app.js and I did not identify any api call to that specific endpoint of orders: POST /api/orders
```
(IDE selection at the time: `test/orders.test.ts` line 114, `body`.)
**What the model returned:** read-only impact check (the dashboard's single `fetch` helper only sends GETs, `index.html` posts nothing, the POST route is the only caller of `ordersDal.create`, the seed always passes `type`), then a plan: make `type` required in the validator, give every invalid-case fixture a valid `type` so each test fails for one reason only, add missing/undefined/null `type` cases, update api.md, architecture.md, the task record and this file. It also pointed out that `src/db.ts` still declares `DEFAULT 'sale'` and proposed leaving it.
**Accepted / rejected / refined:** Javier stayed in plan mode once to comment on the DB default: "for now we are good with having the validation explicity before actually reaching the orderDal. But in the feature if another service uses orderdDal to create an order we are going to still have the same problem -> default -> sale. We will leave this change out of scope since it requires a DDL script." The model added the nuance that `ordersDal.create` already requires `type` at compile time, so the default is reachable only through raw SQL; recorded as a known gap in architecture.md. Javier approved; the model applied it: `tsc` exit 0; 96 tests, 96 pass, 0 fail/skipped/todo/cancelled.

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

### Example 3 — recorded by Claude, session 2 [to confirm by Javier]

- **The prompt:** Session 2, prompt 3 (tasks final definition), plan question 4.
- **What Claude returned:** recommended including ESLint (two new devDependencies, `eslint` and `typescript-eslint`) in the golden-gate task JS-006, and treating the plan reply as the dependency approval.
- **What was wrong with it:** it optimised for the gate text already in `CLAUDE.md` and ignored two constraints Javier had stated in the same session: new dependencies can bring new vulnerabilities (the `npm audit` result was already on the table) and the remaining time budget. The recommendation would have added dependency review and lint-cleanup work to the task that was moved last precisely because of time.
- **How I caught it:** Javier rejected it in prompt 4: "Eslint add new dependencies which means possible new vulnerabilities could be found - due to the time i have, please move it to post mvp".
- **What I did instead:** JS-006 contract written with `tsc --noEmit` + `npm test` only, ESLint and the SQL-injection lint gate listed as Post MVP in JS-005/JS-006; flagged that the ESLint bullet in `CLAUDE.md` now needs Javier's own edit.

### Example 4 — recorded by Claude, session 4 [to confirm by Javier]

- **The prompt:** Session 4, prompt 1 ("next task", JS-005 plan) and the JS-005 contract Claude wrote in Session 2; rejected in Session 4, prompt 5.
- **What Claude returned:** a validator for `POST /api/orders` where a missing `type` defaults to `sale` (`(type as OrderType | undefined) ?? 'sale'`), with the same rule written into the contract's Objective, Edge cases and Acceptance criteria, and a test named "minimal valid body defaults type to sale".
- **What was wrong with it:** Claude copied the pre-existing behaviour (`type: body.type ?? 'sale'` in the original route) into a task whose whole purpose was to stop invalid data entering the orders table, without questioning it. `type` decides the sign of the amount in revenue and metrics (JS-004), so a client that forgets the field silently records a refund as a sale and inflates revenue. A default on a field that carries business meaning is a guess made on the client's behalf. Claude also did not mention that `src/db.ts` has the same default at column level until Javier's rejection forced the impact check.
- **How I caught it:** Javier, reviewing the step B diff line by line before committing: "we are creating an Order - we must know if it is sale or refund and do not decide by default."
- **What I did instead:** `type` is required in `src/lib/validate-order.ts`; tests rewritten so every rejected fixture carries a valid `type` (one failing rule per case) plus explicit missing/undefined/null `type` cases in `test/validate-order.test.ts` and `test/orders.test.ts`; api.md documents the behaviour change; the DB column default is left in place by Javier's decision (needs a DDL migration) and recorded as a known gap in `docs/architecture.md`.
