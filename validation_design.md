# Validation design — Luis Javier Sierra Juarez

> **Write this yourself, without AI assistance.** Spell-check is fine. AI-drafted validation design is an automatic decline — this artifact measures *your* judgment about how to make AI-augmented code safe to ship, which is the load-bearing architect-tier signal.
>
> ~300 words total. Concrete, named gates only — not philosophy.

## Authorship declaration

I wrote this validation design entirely without AI assistance.

---

## The question

Anyone with a competent AI tool can fix the symptoms in this codebase. What separates an architect is *building the validation layer that catches the class of bug next time* — so the same mistake cannot quietly reach production again.

For each issue class you addressed, name the gate you built (or would build with more time) that prevents the class — not just the instance. "Added a regression test" is the floor; what's the gate?

Forms a gate can take, in rough order of robustness:

- A regression test pointing at the specific bug (floor — always add this, never the whole answer)
- A property-based or fuzz test that asserts an invariant the bug violated
- A golden test / contract test at the API boundary
- A CI rule, lint rule, or pre-merge script that fails on the pattern
- A type-system constraint that makes the bug uncompilable
- An architecture rule or import-restriction that makes the bad shape impossible
- An eval suite that grades AI output against the class of failure

## What to fill in

For each issue *class* you addressed (not each instance — group by class):

### Class 1 — Frontier traspassing

I fixed the metric frontier that was traspasing order frontier. The contract specification for Orders schema belongs to OrderDal. Also, metrics was creating its own connection to the database. The gate that prevents this is not explicit defined and is something I would like to put as must in Claude.MD - This because the workflow I defined is to define contracts before Code. Contracts are read and discussed with Claude code in an architecture Session - thanks to this Cluade will exactly know that frontiers can not be traspassed. Services was created with this purpose on the end but not explicit rule has been written yet.

### Class 2 — Claude configuration and Claude Session before any code

I fixed the tasks I have declared at the beggining. I was trying to solve this in order: CI golden gate, Security (with 3 taks inside - SQL inyection - this was false, I had to understand how it actually worked, Dependencies, Custom project errors), revenue frontier fix - was written wrong I meant metrics. I build a gate with Claude code session to actually check every single task scope and spec before implementing any code change - create contracts. If a new developer tries to fix something he should follow the task management system which will help to write contracts first before any code implementation. can be seen on CLAUDE.md and documentation/tasks folder.

### Class 3 — Outbox

I prevented a real world scenario I have faced by my self. When creating an order and creating an event - dual-write could present an error if any of these creashes leaving the system with 2 different status (order created, event missing). Outbox presented on orders-service.ts - createOrder -> executes the dual write into a single transaction so we are forcing atomicity - both happen or neither happen.

## Anti-patterns we score against

- "Added regression tests" with no class-level gate proposed for any class. The instance is patched; the class is not.
- A gate proposed for every class but none actually built in the diff, with no honest accounting of why.
- Generic prose ("I would invest in observability and CI quality") with no named tool, rule, or invariant.
- A 30-line wall of suggestions that reads like an AI-generated checklist. We expect 1–3 *real* gates designed deliberately, not 10 generic ones.
