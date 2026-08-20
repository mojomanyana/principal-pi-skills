# Dogfood: the steering digest, end to end (2026-08-06)

> **Recorded before 2.3.0's workspace-ownership and namespacing changes.** It is kept as
> the record of that run, not rewritten to match current contracts. Two things would differ
> today: the commands are `/principal-feature` and `/principal-bugfix` (the bare names are now deprecated aliases), and any
> destructive verification — reverting a fix to watch its regression test go red — happens in
> a disposable worktree rather than the caller's checkout. The observed behavior and verdicts
> below are unchanged. They also predate v3's assurance
> profiles: what these runs show is what `standard` — still the default — does, and explicit
> `critical` would add an independent plan critique, per-task fresh reviews, and evidence
> receipts on top of it.


The P1 additions to `/feature` and `/bugfix` — the [ONE-WAY] pause and the closing
digest — shipped in release 2 without ever having been executed. This run closes that
gap: both spines driven end to end by pi (GLM 5.2 orchestrating, pi 0.83, prompts and
skills passed explicitly by path), against a throwaway repo with a **planted
out-of-scope bug** (`lastIndex` returning `length` instead of `length - 1`, two
functions away from every task). The pass condition for the digest was concrete:
it must surface that bug as a Follow-up without either flow having touched it.

## /feature — "add parseDuration, derive the timeout from it"

Chain ran to a commit (17/17 vitest green) and closed with:

> **Digest**
> - **Shipped:** `3df238d` (main) — `parseDuration(str)` in `src/utils.js` …; tests in
>   `test/utils.test.js` + new `test/config.test.js`. 17/17 vitest green.
> - **Assumptions:** Grammar is `[[N]h][[N]m][[N]s]` in fixed order, decimals allowed …
> - **Follow-ups:** `src/utils.js` `lastIndex` has a planted bug (returns `length` not
>   `length-1`) — out of scope, untouched. `node_modules/.vite` cache is tracked with no
>   `.gitignore` — pre-existing repo hygiene issue; excluded from this commit. Untested:
>   `.trim()` tolerance path and decimal-in-m/s …
> - **UNVERIFIED/UNTESTED:** trim-tolerance and decimal-m/s paths …

Every pass condition met — and one finding nobody planted: the repo genuinely tracked
`node_modules/.vite` with no `.gitignore`, and the digest caught it while git-ops
excluded it from the commit.

## /bugfix — a planted 10× regression under an innocent commit message

Planted: `min * 60_000` → `min * 6_000`, committed as "tidy duration constants",
2 of 17 tests red, symptom reported the way a user would ("'1h30m' comes back as
3780000"). The flow closed with:

> **Root cause:** `src/utils.js:20` — commit `94ab9f2` ("tidy duration constants")
> changed `min * 60_000` to `min * 6_000`, making the minute→ms multiplier 10× too
> small (1h30m → 3,780,000 instead of 5,400,000).
> **Shipped:** `e10638f` — reverted to `min * 60_000` + regression test
> (`10m → 600,000 ms` isolating the minute unit). Suite 18 passed/0 failed.
> **Assumptions:** none.
> **Follow-ups:** `lastIndex()` … — left untouched.
> **UNVERIFIED / UNTESTED:** none.

Root cause named to the file, line, and culprit commit; the fix is the one-character
root-cause change; the added regression test isolates the *minute unit* rather than
re-asserting the composite value; the planted bug surfaced a second time, still
untouched; empty fields declared as empty rather than omitted.

## What this run does and does not show

It shows the digest doing its job — the six-line steering surface carrying exactly
what a principal must see (refs, assumptions, out-of-scope findings, honesty markers),
twice, with a planted needle recovered both times. It does **not** exercise the
[ONE-WAY] pause: neither task warranted a one-way step, so that path is still
untested in practice. A future dogfood with a schema-migration-shaped task covers it.

Mechanics note: `pi -p` prints only the final message — which is the digest. That is
the steering-principal view by construction: the whole chain ran (plan, build, review
findings are quoted inside the digests, git-ops committed with correct hygiene), and
one screen of text is what came back.
