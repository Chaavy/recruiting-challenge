# Decision Log — Luis Javier Sierra Juarez

> **Write this yourself, without AI assistance.** Spell-check is fine. AI-drafted, AI-rewritten, or AI-polished decision logs are an automatic decline — see `SUBMISSION.md` for why.
>
> Two pages max. Specifics over generalities. Confidence and disagreement are part of the score — own both.

## Authorship declaration

I wrote this decision log entirely by my self and the decisions were taken and confirmed by me. I used AI for this limited porpuse: Remember my real decisions made during the sessions.

---

## Issues addressed

> Defects, security smells, architectural problems, missing pieces, scaling risks — anything you decided was worth your time. For each, fill in **every** sub-field. An empty field is a worse signal than an awkward answer.

- **Issue 1 — metric frontier fix**
  - What was wrong or weak: Direct dependency between frontiers - metric was traspassing orderDal. And also a Revenue issue for totals.
  - Shape of my improvement: decouple metrics from order schema - use ordersDal instead. A constant SQL piece of query that is injected by code (nor user) - to calculate total accordingly.
  - **Confidence (1–10): 8 - I did write the bad frontier at the begining
  - **What would falsify this fix** 
  - **I disagreed with Claude on:** - I mistach the frontier name, Claude code spotted and personal notes updated. Claude spotted a real P0 on revenue and I decided to include it on this task.
  - Alternatives I considered and rejected: Claude spotted other 2 bugs but I decided to moved as out of scope - post mvp.

- **Issue 2 — tenant isolation - Post validation**
  - What was wrong or weak: When doing a query on orders there where not a clause to validate by tenant. Post request in orders where not beign validated.
  - Shape of my improvement:  For tenant isolation - validate with an clause by merchant-Id to filter by two columns, and the route now passes the merchantId. For post validation on /api/orders/ a function that validates fields accondingly.  
  - **Confidence (1–10): 3. After Claude code spotted that there was not SQL injection - the scope of this task changed to tenant isolation and post validation - confidence for these 2: 7
  - **What would falsify this fix:**
  - **I disagreed with Claude on:** the type defined by default to sales. I decided to include this validation in the function created. So request must send the correct type: sales or refund.
  - Alternatives I considered and rejected: DB layer also has default type to sales - I decided to move it out of scope and register as backlog task.

- **Issue 3 — CI rule - golden gate**
  - What was wrong or weak: Human or Claude code could commit with out checking if the test cases were passed correctly.
  - Shape of my improvement: Implement a golden gate that prevents commits if any test is not green. Use a hook with a pre-commit script that runs the npm run check that prevents the commit if it does not pass.
  - **Confidence (1–10): 8
  - **What would falsify this fix:** --no-verify command could skip it (also documented as a real issue)
  - **I disagreed with Claude on:** 
  - Alternatives I considered and rejected: Eslint and GitHub actions moved out of scope due to dependecies needed and time left to complete challenge. 

## Feature chosen

- **Feature:** Feature B — Order-event webhooks
- **Why this one and not the others:** this feature is the one that I have more experience working with. I feel more confident with real-world scenario.
- **What I cut to ship it in budget:** JS-009 — Webhooks slice C: dispatcher, HMAC signing and retry policy and JS-010 — Webhooks slice D: merchant-facing documentation and end-to-end check
- **Confidence (1–10) that the shape I picked is the right one:** 9
- **What would change my mind:** and Event-driven service. Right now this API is taking care of retries, no DQL.

## Things I noticed but did NOT fix

> Class-of-bug instances you saw and chose not to touch. For each, name the *reason* you cut it (scope / time / dependency / "needs a larger conversation").

- ESLint - add new dependencies which means possible new vulnerabilities could be found - due to the time i have, please move it to post mvp
- Server-side CI (GitHub Actions) - needs a larger conversation and is out of time
- Dependency audit findings - dependecy
- Custom project errors - needs a larger conversation
- Mixed formats for dates - scope
- Float money on api - scope
- Column default `type TEXT NOT NULL DEFAULT 'sale'` - scope
- Dead-letter queue for webhook events - scope
- `GET /api/orders?from&to` has the same `to` boundary bug - scope and time
- `limit` query param Nan - scope
- `POST /api/orders` with an `X-Merchant-Id` error code wrong - scope
- `customer_email` is only checked for "not blank" - scope
- Auth model: the `X-Merchant-Id` header is trusted as is - scope
- Test files are not type-checked (only src) - scope
- Emit `order.refunded` and `order.status_changed` - scope
- Dashboard UI to create, view and delete the webhook subscription - scope
- SSRF hardening - time
- Multi-process safety for the dispatcher - scope
- Webhook secret rotation - needs a larger conversation
- Endpoint to list a merchant's webhook events - scope
- Webhook signing secrets are stored in plaintext - needs a larger conversation - scope
- CI improvement - scope
- CD - scope
- Metrics and observability - scope
- Scale frontend - needs a larger conversation
- Scalability users (x10, x100, x1000) - scope and needs a larger conversation
- Reliability (disaster recovery) - needs a larger conversation
- MVP, releases, bracn strategy - time

## Docs / code I left alone deliberately

- packge.json and package-lock.json
- public - frontend
- tsconfig.json

## What I'd do with another 6 hours

- Implement the last 2 slices for the feature - Order-events hooks
- Validate line by line the lines of code I did not verify - most of them are unit testing. I will try to do real test scenarios and a complete Testing regression test.
- I would improve the CI golden gate - code scanners - github actions - -noveryfix fix
- based on the bugs I spotted and that are already registered in the backlog tasks - I would start putting a classification and then start fixing the P0s
- Do a real end-to-end testing on the application

## Where I felt uncertain

> At least three places in this submission where you were not confident. Genuine uncertainty is a strength signal. "Nothing — I was confident everywhere" is itself a red flag and will be probed.

- First personal-notes definition - I spent more than 3 hours trying to define the way I would tackle this challenge - At the end I decided to stop designing and start working
- If a hook could prevent a human to do a commit if certain rule is not met
- For two taks I have not put any objection with claude code - At the end, the very first session with him was the reason - I tried to put the contracts first and during tasks development most of decisions were already taken
