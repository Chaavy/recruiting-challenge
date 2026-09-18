Context: This file includes my personal notes for this project. I have not used AI to write this file neither to read Project code base. I used AI as mentor/colleague to validate the scope and prioritization: After trying to define the best structure for this project and trying to find the real "pain" I realized that I have spent over 3 hours on:
- understanding the codebase
- trying to identify frontiers
- contextMap
- MVPs, releases and branch conventions
- 3 issues and 1 feature 
- And most of the codebase / architecure issues declared in a post MVP and personal notes in a notebook
I have only 3 hours left to complete the challenge. AI raised the hand and told me that I was desgining more than what I could deliver for this challenge, I´ve decided to stop designing and start working with what I currently have.

This is a Mono repo project that based on the Merchant selected, executes a request to an API to display the orders information (Summary and Recent Orders). These are the frontiers identified: 
1. Merchant
2. Orders
3. Metrics
4. Revenue
5. Analytics
6. Auditlog
And this is the context map that shows the dependencies of each. Context Map:
 Independent frontiers: Analytics and Auditlog - Not implemented yet.
 Coupled frontiers:
 Merchant -> there is not functionality to create a new Merchant. Orders, Revenue and Metrics depend on -> merchant ID
 Orders ->  Orders Dal -> Orders Table
 Revenue -> Orders Dal -> Orders Table
 Metrics -> Orders Table

 *I identified that Revenue is using OrdersDal, Metrics is not using a Dal

After reviewing project and code base - I identified the following tasks and I have ordered them by priority based on my personal judment. In order to develop each feature/fix, I propose the following branch convention strategy:

- (out of scope, see Post MVP 8) MVPs - Every single development must belong to an MVP
- (out of scope, see Post MVP 8) Release - Each MVP is divided into realeases branches
- (out of scope, see Post MVP 8) Branch (bugfix/feature) - Each release is conformed by multiple features - bug fixes
    - (out of scope, see Post MVP 8) Base branches: main - prd - uat - dev - release - feature/bugfix (RC - RecruitingChallenge)

MVP1 - This is the MVP that will be completed by the end of this challenge

release/1.0.0
1. Personal-notes file (this file)
Objective: General Project overview - development convention - tasks discovery
Notes: NO AI used yet, I read every single line of the codebase, identified project frontiers, gaps, vulnerbailities and improvements. ordered these items by criticity.
(out of scope, see Post MVP 8) Branch: feature/RC-001-personal-notes-file

2. Claude code integration
Objective: Integrate claude into this project
Notes: Specify repository and project rules - how to run this project and how to test it - what Claude code can not do by itself, create structure of tasks (pending and done) and its specification (this will be my contract for each task - we will only create 4 tasks, 3 of them to fix something and 1 to develop a feature).
Design golden gate rules for CI, generate hook to prevent commit if golden gate is not met (this will have its own task - Taks number 1).
What is not included: Project skills, project custom commands, session history, memory git-based.
(out of scope, see Post MVP 8) Branch: feature/RC-002-claudecode-integration

Claude Code Notes: 
For each sesssion with claude code the workflow must be like this:
1. Prompt that include: Context, Objective, restrictions, edge cases if apply, and what do I spect as result. (me)
2. Plan phase - Claude proposes - I read, validate and raise hand if needed (claude and I)
3. Execution (claude)
4. Unit Test - line by line - validate business rules against unit test if apply (If we modify something inside src folder must have its own unit test) - npm run test - eslint - CI must be green - Developed in task number 1: - Problem 1 - CI rules - golden gate (Claude codes and run tests - I check line by line and output)
5. update task status and index, project documentation (Claude)
6. commit and push - (me)

3. Plan validation - supported by Claude Code as secondary opinion
Objective: An architecture session with claude, where I share the items I have identified (These items are defined here in release/2.0.0 - release/3.0.0 - and POST MVP) - based on priority tasks. Claude code will only act as a second opinion. In which I will own the final decision of how these items will be faced.
Notes: Claude code will not modify any files, this is only a read-only and discussion session - if changes needed I will review them and approve them in next step.

4. Project tasks final definition
Objective: At this point, I have already identified the items to be fixed, I have already had a session with claude discussing these items, based on this: I will confirm what and how we will develop each one (Each of them defined on its own task).
Notes: I will modify this personal notes by me if needed. On step 2, we have created Claude code workflow for task development - I will ask Claude code to create these tasks once are confirmed and reviewed by me.
(out of scope, see Post MVP 8) Branch: feature/RC-003-tasks-final-definition

release/2.0.0
1. Problem 1 - CI rules - golden gate
What is wrong: Before any commit, I want to make sure that the changes that Claude Code and I are going to produce comply with the golden gate.
What I propose: A golden gate in CI, before any commit we must run: ESLint - no warning allowed (Configuration needed), then npm run test. In which all test must be with status: green passed. Not Skipped or failed allowed. If one of this fail we are not allowed to do the commit. A hook will prevent us for over passing it.
Confidence: 9 - I am not sure if I can block human commit with this hook - I am confident that Claude can be blocked.
How to know if I am wrong: TBD
(out of scope, see Post MVP 8) Branch: bugfix/RC-004-CI-golden-gate
Notes after discussion: The hook to prevent human commit is confirmed. We will do the pre-commit that runs the tsc and npm test as well as the test glob in package.json. Also consider  Eslint configuration. The other: GitHub Actions is out of scope and must go to Post MVP section.

2. Problem 2 - Security
What is wrong: While reading codebase I identified the following vulnerabilities (Note each vulnerability will be addressed in its own commit - not a single giant commit):
What I propose:
- SQL Injection: for example: orders-dal.ts and metrics.ts use CUSTOM QUERIES that uses a parameter injected to the QUERY. These parameters are not sanitazed to prevent SQL injection.
- Dependencies: The first time I ran "npm install" I got 4 vulnerabilities (1 low, 3 moderate). Also, there are a lot of dependencies in the package.json files - We must do an audit and remove the ones that are not beign used. The ones are beign used must be a LTS version with its valid SHA.
- Custom project errors: There are multiple cases in which we are giving to the user a detailed error - this will help an attacker to easily understand what is happening/missing. Errors must be more generic.
Confidence: 8 - For sure SQL injection is one critical problem (confidence 10), others 2 maybe can be for post MVP - out of scope
How to know if I am wrong: TBD
(out of scope, see Post MVP 8) Branch: bugfix/RC-005-critical-security-vulnerabilities
Notes after discussion: IA was correct, there is not any SQL injection I was confused - expecting to see :param as JPA.
What the IA found I totally agree with:
Fix the tenant isolation fix plus POST validation. Keep the SQL injection gate anyway. Out of scope Dependencies and Custom project errors go to post MVP section.

3. Problem 3 - revenue frontier fix
What is wrong: TBD
What I propose: TBD
Confidence: 7 - Direct dependency between frontiers - No scalable code. Orders is a critical process in this system needs to be addressed as soon as possible but after CI rules and Security fixes.
How to know if I am wrong: TBD
(out of scope, see Post MVP 8) Branch: bugfix/RC-006-fix-revenue-frontier
Notes after duscussion: I totally mismatch what I wrote, I meant that the metrics frontier was the wrong one - as I declared on the context Map. We must implement this fix - it was the original.
AI also spotted a bug that was not in my radar: The revenue calculation is wrong. This is a real P0, even if I dedicate more time to this fix I will accept the risk. We must fix it as it is a production app. What is also spotted but i put it as out of scope for this task, these two findings: Mixed timestamp formats in one columnn and Float money in the response - go to Post MVP section.

release/3.0.0
1. Feature B — Order-event webhooks
Context: Add a way for merchants to register an HTTPS URL and receive a POST notification when an order is created, refunded, or its status changes. The candidate decides the event payload, the delivery guarantees, the retry policy, the auth between us and the merchant, and how a merchant manages their subscriptions.
Why this one: This feature is the one that I have more experience working with. I feel more confident with real-world scenario.
(out of scope, see Post MVP 8) Branch: TBD
Notes after discussion: Currently No events exist also confirmed by IA. I accept the outbox table (that will also help with auditlog in the feature), I accept the suggestions related to Payload and table. I do also accept Retry and dispatcher suggestions. For Auth I understand that the standar is HMAC-SHA256 so we will go for it instead of public and private key. And I totally agree that we will create a security risk for SSRF - I do also accept to prevent it as the Architect proposes. And we will go as it suggest for Subscription endpoints.

New section because we are running out of time: Order and scope
This is the what AI suggested: 
On budget: your notes say about 2.5 hours remain. My rough estimate is 30 to 40 minutes for revenue, 30 for security, 45 to 60 for CI, and 90 or more for webhooks. You will exceed the six hours. The README asks for that to be written down in the decision log, not hidden. Slice webhooks so that each step is a coherent stop: schema and subscription endpoints, then outbox insert, then dispatcher with signing, then docs. If time runs out after the outbox, "events are persisted, dispatch pending" is still a defensible deliverable.
My decision: Go a head with what is specified in problem 1, problem 2 and problem 3 (Notes after discussion) - for the webhook we will also as it is suggested with small delirables so if we run out of time, we can document and deliver with the proper comments.

Post MVP - This will not be part of the challenge - out of scope

1. CI - improvement - code scanners
2. CD - deployments and rollback
3. Metrics and Observability
4. Code improvement - I have a bounch of personal notes written by hand about findings I found in this repo
5. Escale Frontend - decide technology and framework - create project and connect to backend
6. Escalability - how to prevent application crashes if user interaction grows x10, x100, x1000
7. Reliability - how do we keep our system running even if a disaster occurs - disaster recovery
8. MVP / release / branch strategy - designed above (MVPs, release branches, feature/bugfix branches, base branches) but not applied: with ~2.5 hours left all work goes to one branch (feature/javier-sierra-challenge) with one or more commits per task, task IDs JS-nnn in the commit message.

Code changes review:
JS-004: Day: 18 sep - Hour: 2:40 am.
Commit A: 
After I approved the plan for this task I checked the output:
I validated that completed-only constant is applied correctly to new function: topCustomers. Not a vulnerability a Business rule I accepted.
Metrics.ts After the fix I validated that there is not connection to Database insted now uses: ordersDal
2 new unit testing created: I ran by myself the commands: npm test and npx tsc --noEmit -> successful
Validated that the documentation is also updated
I also validated the change beyond the plan and I accept the determisitic tie-breaker.
I did not read every single line of code of the test.
Commit B:
I reviewed data-range.ts and the function looks good for me.
orders-dal.ts -> new function revenueByMerchant replaces sumAmountByMerchant and also it uses the SIGNED_COMPLETED_AMOUNT_SQL from commit A. 
I have ran unit testing and now 38 tests, suites and all passed, nothing failed also the npx tsc --noEmit -> successful.
Also I opened the dashboard and after a reload the amounts are lower - Revenue (last 30 days) were about 1400 and now is: 809.40
Also task moved to done and index updated - task system working correctly. One thing, Claude spotted a bug that returns 500. Out of scope we will leave at it is, no time to fix new findings.
I did not read every single line of code of the unit tests.