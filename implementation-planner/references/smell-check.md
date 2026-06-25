# Smell-Check

> *"Smell-check the approach before you finalize."* — Tenet 4

A coding spec that's locally correct but globally wrong is the most common failure mode of a tech lead role. The smell-check is the deliberate step where you stop, look at the design from a wider angle, and ask: *is this actually a good idea, given everything I now know about the codebase?*

Specs that skip the smell-check produce code that's reviewed-as-fine and rejected-as-wrong: works in isolation, fights the codebase, duplicates an existing utility, or addresses a symptom while the real problem persists.

---

## 1. The four smells

Every spec is checked for four specific smells before locking. If even one fires, the spec is revised or explicitly flagged.

### Smell 1 — Fighting the codebase

**Symptom:** the design introduces a pattern that doesn't fit, requires special handling, or forces other code to adapt to *it* instead of fitting in.

**Examples:**
- The codebase uses `Result<T, E>` everywhere; the spec adds a throwing function.
- The codebase uses dependency injection; the spec uses a module-level singleton.
- The codebase tests via real boundaries (testcontainers); the spec mocks the boundary.
- The codebase has a serializer at `@/lib/serialize`; the spec adds an ad-hoc serializer inline.

**Cure:** redesign to use the existing pattern. If you can't — because the existing pattern genuinely doesn't fit — name the misfit explicitly and either justify proceeding or recommend changing the pattern first (separate slice).

### Smell 2 — Re-implementing what exists

**Symptom:** the design re-creates a utility, helper, or abstraction that already exists in the codebase.

**Detection:**

```bash
# Search for the verb you're implementing
rg "function.*<verb>" --type=ts
rg "def <verb>" --type=py
rg "func <Verb>" --type=go

# Search for the noun
rg "class.*<Noun>" --type=ts
rg "interface.*<Noun>" --type=ts
rg "type.*<Noun>" --type=ts

# Search known utility locations
ls src/lib/ src/utils/ src/common/ pkg/util/ 2>/dev/null
```

If the search finds something close, the spec must address it:

> *"Considered re-using `@/lib/format-csv` — rejected because it doesn't stream and we hit backpressure with large reports. The new module follows the same `Result<Readable, ExportError>` shape so the eventual unification is straightforward."*

This is honest design. The reviewer can verify the rejection rather than wonder if the utility was missed.

### Smell 3 — Solving the symptom instead of the cause

**Symptom:** the request fixes the surface manifestation, not the underlying problem. Future tickets will report the same problem in different shapes.

**Examples:**
- Request: "Cache the dashboard query for 60s." Real problem: the query is N+1 and would be fast with the right index.
- Request: "Add retry to the API call." Real problem: the API returns 500s because we send malformed payloads.
- Request: "Make the test less flaky." Real problem: the code has a race condition.

**Cure:** name the underlying problem in the spec, even if you still spec the original ask.

> *"Spec note: the request asks for caching, which will mask but not fix the underlying N+1 query (verified by reading `src/api/dashboard.ts:42`, EXPLAIN ANALYZE shows nested loop per record). This spec adds caching as requested, AND flags a follow-up slice to address the query. If the underlying query is fixed, this caching becomes unnecessary and should be removed."*

This respects the user's request while keeping the design honest.

### Smell 4 — Wrong size

**Symptom:** the change is too big or too small for a single coherent slice.

**Too big:**
- Spec touches more than ~10 files.
- More than one architectural seam crossed.
- Multiple unrelated behavior changes.
- A signature rename with more than ~10 call sites.

**Too small:**
- Spec is a single one-liner that would fit in the implementation-planner's slice description.
- No real design decisions — just "do the obvious thing."

**Cure (too big):** refer back to the implementation-planner. Suggest a decomposition.

**Cure (too small):** don't write a separate spec. Put the design as a comment in the slice / handoff baton and route directly to `coder`.

---

## 2. Asking the meta-question

Before locking the spec, ask: **"Is the user solving the right problem?"**

Three sub-questions:

1. **What outcome does the user actually want?** Not the request — the underlying goal. (Not "add CSV export" — "let users analyze data in Excel without manual copy-paste.")
2. **Is the request the best way to get that outcome?** Sometimes yes; sometimes a different path is simpler. (Could we ship a Google Sheets integration instead of a CSV download? Probably overscope, but the question is worth asking.)
3. **What did the user not say that I'm assuming?** (Are CSV semicolons or commas expected? What charset? Is row limit a concern?)

If a sub-question turns up real friction, raise it before specifying:

> *"This spec assumes CSV with commas, UTF-8 BOM, RFC-4180-quoted fields. If you're targeting Excel-on-Windows, the BOM helps Excel detect UTF-8; if you're targeting other tools, the BOM may interfere. Confirm before I lock the spec."*

This is one round of clarification, not a Socratic interrogation. If the user is annoyed by the question, they were going to be more annoyed by the wrong CSV format.

---

## 3. The smell-check output

The spec includes a smell-check paragraph (section 8). It's not a checklist — it's prose, ~3-6 sentences, that demonstrates the check was done.

**Template:**

> *"Smell-check: <approach matches / deviates from existing pattern at X>. Smaller / alternative approach considered (<what>): <why rejected>. <Existing utility considered: name, why it doesn't fit, OR confirmed nothing similar exists>. <Underlying-problem note: is the user solving the symptom? If yes, what's the cause and how to follow up>. Sizing: <fits one slice / suggested for decomposition>."*

**Worked example:**

> *"Smell-check: approach mirrors `export-pdf.ts` exactly — the established pattern for streaming exports. Smaller alternative considered (synchronous CSV via `@/lib/serialize`) — rejected because we'd inherit the backpressure issue export-pdf flagged in its TODO. The closest existing utility (`@/lib/serialize.toCsv`) doesn't stream; mentioned in the spec. No underlying-problem concern: the user wants Excel-friendly export, this directly addresses it. Sizing fits one slice (~3 files, 1 new module, 2 modifications). Slight concern: this is the second streaming exporter; a third would justify a 'streamed export' utility extraction — flagged for follow-up planner consideration, not in scope here."*

That paragraph demonstrates: pattern match acknowledged, alternative considered with reason, duplicate-utility check done, underlying problem addressed, sizing confirmed, follow-up surfaced.

---

## 4. When smell-check kills the spec

Sometimes the smell-check fires and you can't get past it. **The spec doesn't ship.** Instead, the response is one of:

- **"Spec rejected: <reason>. Recommended alternative: <route back to planner / brainstorming / a different approach>."**
- **"Spec needs upstream input: <question>. Pausing until <user / planner> resolves <X>."**
- **"Spec deferred: this change is recommended to be deferred until <prerequisite> is in place."**

The implementation-planner's job includes saying "no, not like this." Refusing a bad spec is more useful than producing a confident-looking spec that ships the wrong thing.

This is non-negotiable for:
- 🔴 reversibility decisions with no kill criterion possible.
- Changes that require infrastructure not present (and the request was "just add this feature").
- Symptom-fixes for known causes when the cause is fixable in a comparable amount of work.

---

## 5. Anti-patterns

- **Skipping the smell-check.** The most common failure mode. The design "felt right" so the spec went out.
- **A smell-check paragraph that's a marketing pitch for the design.** "This is an elegant solution that mirrors industry best practices." Useless. The smell-check identifies what *doesn't* fit, not what does.
- **Naming an alternative just to dismiss it.** "Considered Y — rejected because Y is worse." That's not an analysis. Why is Y worse? What was the actual tradeoff?
- **Pretending no related utility exists.** Search before assuming.
- **Solving every symptom you find.** A spec that grows during smell-check is a spec that lost its scope. Surface adjacent issues; don't fix them mid-spec.
- **One-paragraph smell-check on a 500-line refactor.** Right-size. Big specs need substantive checks.
- **Smell-check that always passes.** If your smell-check never kills a spec, you're using it as a checkbox, not a check.
