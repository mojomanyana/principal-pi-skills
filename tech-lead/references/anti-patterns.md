# Anti-Patterns

A catalog of the failure modes a tech-lead skill is most likely to slip into. Cross-reference these whenever the spec "feels right" — felt-right specs are where most anti-patterns hide.

Each entry has: the smell, the example, why it fails, the cure.

---

## 1. Specs without exploration

**Smell:** The spec was written from memory, training data, or general best practices — not from reading the codebase.

**Example:**

> *"Add a new auth middleware at `src/api/middleware/auth.ts`. It should verify the JWT and call `next()`."*

(The codebase doesn't have `src/api/middleware/`. It uses function composition, not middleware. The pattern is `withAuth(handler)`, not `app.use(authMiddleware)`.)

**Why it fails:** The coder either spends time discovering the pattern doesn't fit (good outcome) or implements the wrong shape (bad outcome).

**Cure:** Run the exploration step (Tenet 1). The spec's exploration notes section is the proof that exploration happened. If you can't fill it out, you can't spec.

---

## 2. Vague design sections

**Smell:** The design section describes intent, not contract. A coder reading it has to make decisions the spec was supposed to make.

**Example:**

> *"Add validation to the login handler. Handle malformed input gracefully."*

(What library? What error shape? Which fields? "Gracefully" how?)

**Cure:** Specific files, signatures, types, and behaviors. "Wrap the request body in a Zod schema at `src/auth/schemas.ts`; on parse failure return 400 with `{error: 'invalid_request', field: <first failing JSON path>}`."

---

## 3. Test plans as headers without bodies

**Smell:** The test plan lists categories but not assertions.

**Example:**

> *"Tests:*
> *- Happy path*
> *- Error cases*
> *- Edge cases"*

(Three categories, zero tests.)

**Cure:** Name each test. Specify the level. Specify the file. Specify the assertion. See [`test-strategy.md`](test-strategy.md).

---

## 4. Mocking the thing under test

**Smell:** The spec mocks the boundary it's supposed to be testing.

**Example:**

> *"In the CSV serializer test, mock `csvStringify` to return `'mocked,output'`."*

(The thing under test is the serializer's interaction with csv-stringify. Mocking csv-stringify means the test asserts nothing about serialization.)

**Cure:** Mock dependencies that are slow, non-deterministic, or expensive. Don't mock the unit you're testing. See [`test-strategy.md`](test-strategy.md) §6.

---

## 5. "No ripples" without verification

**Smell:** The ripples section says "none" without evidence of having searched.

**Example:**

> *"Dependencies & ripples:*
> *- No callers affected."*

(The function being changed has 47 callers found by `rg`. The spec just didn't look.)

**Cure:** State the search method. State the result. "Searched via `rg 'fnName\b'` (12 matches, all in `src/foo/`) and `ast-grep` (12 matches). No additional callers."

---

## 6. Reversibility tags as decoration

**Smell:** Every decision gets 🟢, including ones that aren't reversible.

**Example:**

> *"Add `currency` column to `transactions` table — 🟢"*

(Schema migrations are essentially never 🟢. Once data is written with the column, removing it requires a migration. At minimum 🟡, often 🔴.)

**Cure:** The tag reflects the actual cost of reversal. If reversal requires a migration, coordinated deploy, or downstream change, it's not 🟢. See [`reversibility-for-code.md`](reversibility-for-code.md).

---

## 7. 🔴 without a kill criterion

**Smell:** The spec tags a decision 🔴 but specifies no measurable criterion for reverting.

**Example:**

> *"Replace MD5 password hashing with bcrypt — 🔴*
> *Kill criterion: monitor for issues."*

(Not a criterion. "Monitor" isn't measurable, time-bound, or pre-committed.)

**Cure:** "If login failure rate increases by >2% within 1 hour of rollout, halt deploy and investigate before forward-fix. If any user-facing error correlates with bcrypt rejection of a legitimate password, hot-revert to the old hash within the existing session." Specific, measurable, time-bound. See [`reversibility-for-code.md`](reversibility-for-code.md) §3.

---

## 8. Skipping the smell-check

**Smell:** Section 8 (smell-check) is missing, empty, or a marketing pitch.

**Example:**

> *"Smell-check: This is a clean, elegant solution that follows industry best practices."*

(Says nothing about whether it fights the codebase, whether alternatives were considered, or whether the user is solving the right problem.)

**Cure:** The smell-check is for the smells you found, not the design's strengths. If none of the four smells fire, say so explicitly with evidence. See [`smell-check.md`](smell-check.md).

---

## 9. Implementing the user's exact words

**Smell:** The spec implements the literal request even when reading the codebase reveals the request is asking for the wrong thing.

**Example:**

> *Request: "Cache the dashboard query for 60s."*
> *Spec: Adds an LRU cache around the query function. 🟢, 200 lines of work.*

(Reading the code reveals the query has an N+1 problem that an index would fix in 1 line.)

**Cure:** Surface the underlying problem. The spec can still implement the cache (the user asked), but it must name the root cause and recommend a follow-up. See [`smell-check.md`](smell-check.md) §1, smell 3.

---

## 10. Spec longer than the diff

**Smell:** The spec is 600 lines for a 50-line code change. Over-engineering at the design layer.

**Example:**

> *Request: "Rename the `name` query param to `displayName` on `/users/:id`."*
> *Spec: 800-line document covering migration plan, deprecation timeline, all 47 callers, three options for the rename strategy, performance benchmarks, etc.*

(The change is a 2-line edit plus an optional alias. The spec is more work than the work.)

**Cure:** Right-size. See [`spec-anatomy.md`](spec-anatomy.md) §11. For small changes, the "spec" is a one-liner in the handoff baton, no separate doc.

---

## 11. Spec shorter than the change

**Smell:** A cross-cutting refactor specified in a single paragraph.

**Example:**

> *Spec for migrating from REST to GraphQL across 30 endpoints: "Switch the auth, billing, and dashboard endpoints to use the new GraphQL gateway. Test as you go."*

(Each endpoint has its own contract, its own callers, its own migration risk. One paragraph can't cover this.)

**Cure:** Either expand the spec into a real document or **refer back to the implementation-planner** for decomposition. Cross-cutting refactors are usually not one spec; they're a sequence of slices.

---

## 12. Sycophantic spec review

**Smell:** In Mode E (reviewing someone else's spec), the response defaults to "looks great" with cosmetic suggestions.

**Example:**

> *"Spec review: this is a solid design. One suggestion — consider adding an example in the design section to make it clearer for future readers."*

(The spec under review has no test plan, fights the codebase's error-handling convention, and adds a 🔴 dep with no justification. The review found none of this.)

**Cure:** Run the nine tenets as a rubric explicitly. Be honest about what's missing or wrong. A sycophantic review is worse than no review — it ratifies a bad spec.

---

## 13. Invoking instead of handing off

**Smell:** The tech-lead spec ends with "now I'll go implement this" or starts editing code.

**Example:**

> *"...the spec is complete. Let me now go write `src/api/export-csv.ts`."*

(The skill writes specs, not code. Crossing that boundary defeats the separation that makes the role reviewable.)

**Cure:** End every spec with a handoff baton (Section 10 of the output contract). The user (or an orchestrator) invokes `coder` separately. See [`handoff-to-coder.md`](handoff-to-coder.md).

---

## 14. Treating the planner's slice as the whole problem

**Smell:** The spec accepts the planner's slice description as the problem definition, even when reading the codebase reveals the slice was scoped wrong.

**Example:**

> *Planner slice: "Add CSV export — vertical slice, including UI button."*
> *Spec: Treats this as one slice, designs both the streaming export and the React button.*

(The export and the button are different concerns with different test strategies. Reading the codebase reveals the button needs a separate slice for the modal that hosts it.)

**Cure:** Push back on the planner via the spec's flagged-assumptions or a reverse handoff. The planner can re-slice if needed. The tech-lead's job includes saying "this slice doesn't fit one spec."

---

## 15. Pretending the codebase has conventions it doesn't

**Smell:** The spec asserts a convention that isn't actually in the codebase.

**Example:**

> *"The codebase uses `Result<T, E>`, so the new function returns `Result<...>` ."*

(The spec said this. The codebase actually throws exceptions everywhere except in two newly-added files. The "convention" is two files.)

**Cure:** A convention is two-or-more files **consistently**. Always state where you observed the convention. If the convention is new (one or two files), say so: "Establishing pattern — only seen in 2 newer files; this slice adopts it; spreads on adoption."

---

## 16. Hiding flagged assumptions in body text

**Smell:** Assumptions the coder must reconfirm are buried in design prose instead of called out in §9.

**Example:**

> *Buried in the design section: "...assuming the existing `parseRequest` helper accepts the new optional `csvOptions` field..."*

(That's an assumption that, if wrong, invalidates the spec. It belongs in §9 with a verification step.)

**Cure:** Pull every "assumes", "expects", "should be", "I think", and "probably" out of body text into §9 as explicit flagged assumptions. Each gets a verification step.

---

## 17. Specifying away the user's tradeoff

**Smell:** The user's request has an implicit tradeoff (perf vs. simplicity, completeness vs. shipping); the spec quietly picks one without flagging.

**Example:**

> *Request: "Make the dashboard load faster."*
> *Spec: Adds a complex multi-level cache.*

(There's also a simple-and-acceptable answer: an index. The spec didn't ask which the user wants.)

**Cure:** When a request has implicit tradeoffs, surface them. Either the smell-check section names them, or a brief clarifying question precedes the spec.

---

## 18. Confusing a new pattern with "best practice"

**Smell:** The spec proposes a pattern because it's a "good practice", not because it fits this codebase.

**Example:**

> *"Let's use dependency injection here — it's a best practice for testability."*

(The codebase doesn't use DI anywhere. Introducing it for one module creates a tax on every future modifier of the module.)

**Cure:** Patterns are contextual. The spec adopts patterns the codebase uses; introducing a new pattern is a 🟡-or-higher reversibility decision needing explicit buy-in. "Best practice" is not a substitute for fit.

---

## 19. Skipping the baseline test run

**Smell:** The spec proceeds as if existing tests pass without confirming.

**Example:**

> *Spec proceeds; coder runs the existing tests for the affected area and 3 of them are already red.*

(Now the coder doesn't know if those reds were caused by their changes or were already there. The spec's baseline assertion is broken.)

**Cure:** Run the existing tests during exploration. State the baseline status explicitly in §3. "Baseline: 47 tests in `src/api/`, all passing at HEAD `abc123`."

---

## 20. Treating exploration notes as ceremony

**Smell:** Exploration notes are filled with a generic description ("read the file, looks fine") rather than concrete findings.

**Example:**

> *"Exploration: I read the login handler. The structure looks reasonable and well-tested."*

(Says nothing. No conventions, no callers, no baseline, no risks. The spec rests on nothing.)

**Cure:** Use the six-part capsule from [`codebase-exploration.md`](codebase-exploration.md). The capsule has structure precisely so it can't be filled with platitudes.
