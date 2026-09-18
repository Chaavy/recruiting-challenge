# Written answers — Luis Javier Sierra Juarez
> **Write this yourself, without AI assistance.** Spell-check is fine. AI-drafted, AI-rewritten, or AI-polished written answers are an automatic decline — these questions exist specifically to measure how *you* think, write, and tell stories about your own past work.
>
> ~200 words per question. Past-tense, real systems. See `SUBMISSION.md`.

## Authorship declaration

I wrote this file entirely by my self I used AI for this limited porpuse: Remember my details about my real scenarios

> If English is not your first language, write in English anyway and don't worry about polish. We score substance and specificity, not grammar. Honest rough writing beats AI-laundered prose.

---

## Q1 — Production correctness validation

> Describe a system you owned where you had to add production correctness validation — alarms, contract tests, golden datasets, something that caught a class of bugs before users did. What did you do, what worked, what didn't, and what would you do differently?

> Quinta Chozet. A revenue system to manage different aspects of a business (Cotizador, Agenda, Proveedores, Reportes, Precios, Documentos, Fotos, Contratos). The first very system was an Excel, advisors used this Excel to generate quotes by hand. The real risk was when created Quinta Chozet system - I had to move the prices to a code engine, if this engine failed there was not an error it was just a bad quote with a wrong price that affected directly to the Business. I created a base model in the repository and the expected catalog (this was exported by the Excel). With these 2 pieces now I created a golden gate to check if value by value on a npm run test - if it fails there is a hook that blocks the deployment. This golden gate runs in every single CI. parity 100%, it catches if any rule changes. This parity only checks if the rules still the same but the real prices are edited by advisors in the app. I would take off the Excel and create a snapshot of the rules so no Excel will be needed.

## Q2 — Scaling-forced structural change

> Describe a system you've worked on where scaling — traffic, data volume, team size, or geography — forced a structural change to the code or architecture. What changed, who pushed back, and how did you decide?

> On Scotiabank exists a very concurrent API - most of the others microservices needs information from this service. Dynatrace started showing time outs, slow resposes and bad latency. A Cache service needed to be implemented at the BFF layer to avoid request to this service - most of these request were the same: to get the information of the user and its company. I introduced Redis at my BFF microservices with the authorization of the GLOBAL architecture team. Now, when a user was logged in, this information was saved into Redis - so my feauter payment-taxes could check against Redis to get this information and to avoid requesting it again to the Concurrent microservice. The PO pushed back, this architecture change was not defined in any backlog - came directly from Architecture team. I had to meet with PO explain the situation and move priorities for our features - trying to keep in the sprint planning the important features that were needed for that release.


## Q3 — A time you rejected AI output (or accepted bad output and changed your process)

> Describe a specific moment in real work where you rejected AI output that you initially thought was correct, **or** accepted AI output that turned out to be wrong. Be concrete: what was the task, what was the output, what was the signal that flipped your judgment, and what did you do next? If the answer is "I accepted it and it shipped a bug," what did you change about your process so the class of mistake doesn't recur?

> In Quinta Chozet - I use Claude Code for tasks development (same system as I tried to put in this challenge), A change I accepeted was promoted to production and broke a specific componet page. This is how it happen, after the change was made, unit test were green, I reviewed the Code and looked good so I approved it and promoted to production. Minutes later I received an email from Github CI where it was failed - I tried to check the platform and a Cotizador page and was showing an error. What happend is that the green test did not cover a test for "rendering a component" - these tests were only validating business rules and also these test were not mandatory by any guard - were just memory to remember before deployment. After this, the Deployment was conditionated and a hook was introduced to block a deploy if the local test fail, also for the components rendering issue what I introduced smokes test against a browser (puppeteer) on staging/production - these test are read only for production. What I am missing is an automatic smoke as gate before production - so it is not conditioned to remembering manual execution - I already have an staging environment which can be used for these automatic testing before production deployment.