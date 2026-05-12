# Reversibility for Code

> *"Reversibility tags on code decisions."* — Tenet 6

Bezos' two-way / one-way door framing translates directly to code. The cost of *reversing* a decision is usually more relevant than the cost of *making* it. A spec that doesn't surface one-way doors is a spec that hides risk.

This reference describes how to identify reversibility at the code level, the three-tag system this skill uses, and how to attach kill criteria to one-way decisions.

---

## 1. The three tags

| Tag | Name | Means |
|---|---|---|
| 🟢 | Two-way door | Can be undone with a single PR; no migration; no coordination |
| 🟡 | Costly | Can be undone but requires non-trivial work — rewrite a chunk, retire a public API with a deprecation cycle |
| 🔴 | One-way door | Cannot be undone cleanly — data is migrated, downstream consumers have switched on it, version coordination required |

Each significant design decision in the spec gets exactly one tag. *Significant* means: a decision a reviewer would push back on if they disagreed.

---

## 2. Categories of decision — typical tags

### 🟢 Two-way (default for most changes)

- Adding a new private function, helper, or class.
- Adding a new internal module.
- Renaming an internal symbol (no exported name, no consumers).
- Adding a new test.
- Adding a feature flag that defaults to `off`.
- Refactoring a function body without changing its signature.

These are reversible in a single PR. Ship freely.

### 🟡 Costly

- Adding a new public API (deprecation cycle needed to remove).
- Adding a new internal abstraction that other code starts depending on.
- Adding a non-trivial library dependency.
- Renaming an exported symbol with a compatibility shim.
- Adding a new column to a table with `nullable=true` (forward-compatible read paths required to remove).
- Adding a feature flag that defaults to `on`.

These are reversible but the cost is real — rework required, sometimes coordination across services. Worth doing; surface the cost.

### 🔴 One-way

- Schema migrations that drop or rename columns.
- Public API changes that break consumer call sites.
- Changes to wire formats — JSON shape, protobuf field renames, header semantics.
- Changes to hash, encryption, or signature formats.
- ID format changes that already-issued IDs depend on.
- Changes to monotonic counters, sequences, or other "trust this is increasing" invariants.
- Removing a feature flag (now the behavior is permanent).
- Replacing an algorithm whose output is persisted (e.g., a slug generator, a checksum, a search ranking that the cache depends on).
- Email / notification deliveries (can't unsend).
- Outbound API calls with side effects (can't unpost).

These need explicit attention: the spec, the test plan, and the kill criterion.

---

## 3. Kill criteria for 🔴 decisions

A 🔴 tag without a kill criterion is decorative. The kill criterion answers: **"what evidence, available before we commit further, would make us revert?"**

Bad kill criteria:
- "If something goes wrong, revert."
- "Monitor for issues."
- "We'll roll back if needed."

Good kill criteria:
- "If 500 rate on `/login` exceeds 0.5% within 30 minutes of rollout, revert before completing the deploy."
- "If any downstream consumer (audit-service, billing) reports a parse error for the new error code in the first 48 hours, revert and use the existing code."
- "If migration `20260512_*` takes longer than 10 minutes on production data sample, abort and re-plan."

The kill criterion is **measurable, time-bound, and pre-committed**. Specifying it during design means the team doesn't argue about it during an incident.

---

## 4. The reversibility table — output format

Every spec includes this table in section 7:

```markdown
| Decision | Tag | Rationale | Kill criterion (🔴 only) |
|---|---|---|---|
| Add csv-stringify dep | 🟡 | Removing later requires switching all CSV callers off it | — |
| New `/export/csv` route | 🟢 | Trivial to remove; no consumers yet | — |
| Add `STREAM_FAILED` to `ExportError` enum | 🔴 | Downstream services switch on this enum; removal breaks them | If any downstream consumer can't handle the new code by D+7 (per integration test or report), revert and use `QUERY_FAILED` |
| Update prometheus metric names (`export_csv_*`) | 🟡 | Renaming metrics later requires dashboard / alert rewiring | — |
| Change `User.fullName` to `User.displayName` | 🔴 | Wire-shape change; clients depend on the field | If client integration test fails after D+1, revert; re-plan as deprecation cycle |
```

The table is dense by design — each row is a decision with consequences. Reviewers can scan for 🔴 rows quickly.

---

## 5. Strategies for converting 🔴 to 🟡 (or 🟢)

Often, a 🔴 can be downgraded by changing the approach. The spec should ask: **can we ship this in a way that's reversible?**

### Strategy 1 — Add before remove

Instead of renaming `fullName` to `displayName` (🔴), add `displayName` as an alias (🟡 — it can be removed). Migrate callers over N slices. Remove `fullName` later (a separate 🔴 decision deferred).

### Strategy 2 — Feature flag

Wrap the new behavior in a flag. Default off. Rollout incrementally. The flag-off state is identical to "no change" (🟢 to remove the new code path while the flag is off). The 🔴 only kicks in when the flag is permanently on.

### Strategy 3 — Shadow mode

Run the new code alongside the old, comparing outputs. No customer impact; only operator visibility. The 🔴 cutover is deferred to a later slice where the data has confirmed the new code matches.

### Strategy 4 — Versioned endpoint

Don't change the existing endpoint's contract. Add `/api/v2/...` with the new shape. Keep `/api/v1/...` until consumers migrate. The 🔴 (deleting v1) is deferred until consumers actually move.

### Strategy 5 — Backward-compatible data layout

Migrations: add a nullable column instead of renaming. Read code handles both old and new. Write code populates only the new. Once all reads are off the old column, drop it in a separate slice.

The spec should **try one of these strategies** before locking a 🔴 with high consequences. Document the attempt:

```markdown
**Strategy considered:** Could rename in two phases — add `displayName` as alias,
migrate callers, then drop `fullName`. Decided AGAINST because the API contract
also exposes `fullName`, and decoupling those is a larger refactor (separate
slice). Therefore: this slice is recommended NOT to proceed; refer back to
planner for decomposition.
```

This is honest design — the spec doesn't just tag 🔴; it tries to avoid 🔴 first.

---

## 6. Reversibility at the test level

A subtle point: tests themselves have reversibility. A test that's hard to maintain "locks in" a behavior even when the behavior wasn't meant to be permanent. Examples:

- A **snapshot test** of a rendered page locks in every visual detail. Changing button text means updating the snapshot — fine for stable UI, painful for evolving UI.
- An **end-to-end test** that asserts the wire format locks in the wire format. Changing the API later means breaking the test.
- A **brittle integration test** that relies on a specific log line locks in the log line.

When the spec adds tests, briefly note their reversibility:

```markdown
**Test reversibility:**
- New unit tests: 🟢 (per-test edits are cheap).
- New integration test asserting CSV wire format: 🟡 — future format changes
  will require updating this test alongside.
- No snapshot tests added (deliberate; the dashboard's existing snapshot tests
  cover the UI surface).
```

The point is to be aware that tests, like code, calcify the things they encode.

---

## 7. Worked example — when reversibility analysis blocks the spec

> Request: "Switch our session ID format from random base32 to UUIDv7."

**Initial analysis:**

- Old session IDs are stored in cookies on user devices. Already issued.
- New format won't validate against the old regex. Old format won't validate against the new regex.
- Sessions table has indexed `session_id varchar`. Schema doesn't change, but the existing rows have the old format.

**Reversibility:**
- 🔴 — Once new IDs are issued, the system has two formats in circulation. Reverting means either invalidating all new sessions (bad UX) or keeping both formats indefinitely (defeats the purpose).
- Kill criterion can't really protect us: by the time we'd revert, the new IDs are in user cookies; we can't recall them.

**Strategy applied:** Run both formats in parallel.
1. Add UUIDv7 issuance behind a `SESSION_ID_FORMAT_V2` env flag (off by default). Validation accepts both formats.
2. Phase rollout: enable for new sessions only; let old sessions expire naturally.
3. Once old format is rare (<1% of active sessions per metric `sessions_by_format`), remove old issuance.
4. After old sessions fully expire (max session lifetime), tighten validation to UUIDv7-only.

**Result:** original 🔴 becomes a sequence of three slices, each 🟡 with explicit kill criteria.

**Spec output:** This slice (slice 1) is recommended; slices 2 and 3 are deferred to the planner. The original "switch session ID format" framing is now flagged as needing decomposition.

---

## 8. Anti-patterns

- **No reversibility section.** The spec hides risk. Reviewers can't easily spot 🔴 decisions.
- **🔴 without a kill criterion.** Decorative. The tag exists to trigger a decision; without the criterion, no decision is encoded.
- **Tagging everything 🟢.** The bar is "would a reviewer push back?" If nothing in your spec is contestable, the spec is too small or too vague.
- **Tagging everything 🔴.** Inflation. If everything is one-way, the team learns to ignore the tag.
- **"It's a small change, no reversibility needed."** A two-line change to a hash function is one-way. Size doesn't determine reversibility.
- **Assuming feature flags solve everything.** Flags help, but they're not free — every flag is a forking code path that has to be maintained. Use them, then plan to remove them.
- **Putting kill criteria in the PR description.** They belong in the spec. The PR is where the criteria are enforced, not invented.
