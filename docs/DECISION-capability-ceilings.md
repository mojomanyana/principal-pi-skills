# Decision — capability ceilings for the seven skills

**Date:** 2026-08-16 · **Status:** accepted · **Settles:** the open question in
[pi-daddy's integration handoff](https://github.com/mojomanyana/pi-daddy/blob/main/docs/HANDOFF-principal-pi-skills-integration.md)

pi-daddy turns a `SKILL.md` `allowed-tools` field into an enforced capability ceiling — pi's own
`--tools` allowlist, applied to a separate OS process. It asked this repo to choose each skill's
ceiling, and flagged one question as unresolved: `decide`, `architect` and `plan` each *produce a
document*, and writing a document sounds like writing a file, so perhaps they are real subagents
needing `Write` rather than the read-only ones its table assumed.

The answer is that they are read-only — but not for the reason the tidier table wanted, and the
same re-derivation overturns two other rows the handoff was confident about.

## The constraint, verified

Checked against `pi-daddy` at `a07eaaa`, in the source rather than the prose:

- **No notion of a path.** `resolve()` is set intersection over opaque string ids
  (`packages/pi-daddy/src/resolve.ts:121-198`). `toPiToolsAllowlist` strips the `tool:` prefix and
  hands the rest to `--tools`. Nothing anywhere parses a path.
- **Sub-tool patterns are refused, not narrowed.** `ceilingForDefinition` routes any entry
  containing `(` into `patterns[]` rather than into capabilities
  (`src/definitions.ts:181-184`), and the field's contract says non-empty means *"the caller must
  refuse and say so"* (`src/definitions.ts:71-86`). So `Write(docs/**)` does not yield a narrow
  write — it makes the skill unspawnable.

Both confirmed. *"An architect that may write an ADR but not your source"* is not expressible, and
the choice really is between a document-producing agent with unrestricted write and one that
returns its document as text.

Two further facts, load-bearing here and **absent from the handoff**:

- **`bash` already confers `write` and `edit`.** pi-daddy's own subsumption table maps `tool:bash`
  onto `{grep, find, ls, read, write, edit, edit-diff}` (`src/resolve.ts:43-53`), with the comment
  *"a grant containing `bash` is not a narrow grant."* Any ceiling containing `bash` is a full-authority
  ceiling, whatever else it lists.
- **pi has no `glob` tool.** Its built-ins are `bash, edit, edit-diff, find, grep, ls, parallel,
  read, write` (`src/pi-tools.ts:23-25`). Name mapping is lowercasing and nothing else, deliberately,
  so `Glob` becomes `tool:glob`, which the catalog then refuses as unknown
  (`src/definitions.ts:170`, `src/catalog.ts:161`). The handoff's table put `Glob` on six of its
  seven rows — every one except `git-ops` — so as written, six of seven would be refused.

## Re-deriving it from the skill bodies

**The premise to reject is "writing a document is writing a file."** In this framework a document is
a *message*, and that was settled before pi-daddy existed. `build/SKILL.md:15-21` states the doctrine
outright:

> **You are the only phase that writes durably.** Plan reads; debug and review experiment in
> disposable workspaces and throw them away. The change lands here, once, in the user's checkout,
> where they can see it. […] a fix "already applied" somewhere the user cannot see is a fix they
> cannot review.

That last clause is the whole argument, and it generalises: a plan or an ADR written to disk by a
subagent the operator did not watch is a plan the operator did not review. Every advisory skill
already ends in a fenced template it *emits*:

- `decide` — "## Output — decision brief", a block, no path.
- `architect` — asked outright to *"write an ADR for the config rename"*, its body answers that
  **the three-line note IS the deliverable** (`architect/SKILL.md:37-40`). The README says the same:
  *"The decision record is a section of the output, not a separate artifact"* (`README.md:50`).
- `plan` — "## Output — plan", ending `Next: build`. Its own description: *"writes no code."*

So option (b) — return the document as text — is not a degradation the operator accepts in exchange
for safety. **It is what these three skills already do**, today, interactively, with no pi-daddy
involved. There is no round trip to pay for: the parent already receives the block, and already
routes on it (`review`'s `Next:` line is explicitly *"the caller routes on it mechanically"*). The
read-only framing was not reaching for a tidier story; the `Write` on `plan` was.

### The repo had already answered two of the three disputed rows

`plan`, `review` and `debug` also ship as pi subagents, whose frontmatter carries a `tools:` key —
the same ceiling in the sibling format. Those declarations already existed, in pi's exact lowercase
tool names, and nobody consulted them:

```
agents/plan.md:9:    tools: read, grep, find, ls
agents/review.md:9:  tools: read, grep, find, ls, bash
agents/debug.md:     (no tools: key)
```

`plan` was already declared **without** write, and `review` already declared **with** bash — the two
rows this decision overturns, settled independently before the question was asked. That is
corroboration, not authority, so the reasoning below stands on the bodies; but a table derived "from
each skill's own description" that contradicts the skill's own existing tool declaration was reading
the wrong field.

`debug`'s missing `tools:` key is the third finding. In pi-subagents an absent `tools:` means *pi's
full default toolset*, so today debug's twin is the **most** powerful of the three by omission —
precisely the inversion pi-daddy calls out and reverses (`src/definitions.ts:18-20`). This decision
fixes that too, by declaring debug's ceiling in both formats.

### Two rows the handoff got wrong

**`review` is not read-only.** The handoff called it *"the only unambiguously read-only skill"* and
sourced that from its description: *"Reports findings; never edits."* That string appears **nowhere
in this repository** — `grep -rn` returns zero hits in any file. And review's actual body says the
opposite (`review/SKILL.md:58-68`): *"Verify, don't assume — in a workspace you own. Run the tests
[…] make the regression test go red, break an input and watch the guard fire"*, in a throwaway
worktree it creates with `npx principal-pi-workspace create`. Denying it `bash` would not make it a
safer reviewer; it would make **every verdict `UNVERIFIED`**, which its own body calls *"not a soft
approve"*. The one row the handoff called defensible is the one that breaks its skill.

**`debug` is not meaningfully narrower than `build`.** The handoff gave it `Bash` to run the failing
test and withheld `Edit`. But debug's probes *do* edit code — in a disposable worktree it reaches
through `bash` — and by pi-daddy's own subsumption table `bash` already confers `write` and `edit`
regardless. So the honest answer to *"does granting debug Edit make it indistinguishable from
build?"* is: **at the ceiling, debug is already indistinguishable from build**, and adding `edit`
would change its tool surface without changing its authority. We therefore omit `edit`/`write` — a
smaller `--tools` surface is worth having — while recording plainly that this is a narrower *surface*,
not a narrower *authority*.

Debug's and review's confinement to a disposable worktree is enforced by their bodies, **not** by
pi-daddy, and cannot be, for exactly the reason `Write(docs/**)` is refused: it is a claim about
paths.

## The decision

Declared in pi's tool names, lowercase. `Read, Grep, Glob` reads more naturally and is what the
`allowed-tools` spec field looks like elsewhere, but `Glob` is refused here and the enforcing
consumer is pi — so the declaration is written against the thing that enforces it.

| Skill | `allowed-tools` | Why |
|---|---|---|
| `decide` | `read, grep, find, ls` | Deliverable is the decision brief, emitted in the response. Nothing in the body writes. |
| `architect` | `read, grep, find, ls` | The ADR is a section of the output, by explicit decision (`architect/SKILL.md:37-40`, `README.md:50`). |
| `plan` | `read, grep, find, ls` | *"Plan reads"* (`build/SKILL.md:15`); *"writes no code"* (its own description). **This resolves the flagged contradiction: the prose was right and the table's `Write` was wrong.** |
| `review` | `read, grep, find, ls, bash` | Creates a disposable worktree and runs the tests. Without `bash` every verdict is `UNVERIFIED`. **Overturns the handoff.** |
| `debug` | `read, grep, find, ls, bash` | Reproduces the failure and probes it in a disposable worktree created via `npx`. `edit`/`write` omitted as surface, not as authority — see above. |
| `build` | `read, grep, find, ls, edit, write, bash` | The only phase that writes durably, in the caller's checkout. |
| `git-ops` | `read, bash` | git *is* bash. Its writes are commits, not tool calls. |

Four skills read-only, three hold `bash`. The two-tier property the integration sells survives — but
the tiers are **advisory vs. executing**, not *"four structurally incapable of modifying anything"*.
Only the four read-only ones are structurally incapable, and that is now true of exactly the four
whose bodies say so.

### Verified against pi-daddy's own code, not a re-implementation

Running `parseSkillDefinition` → `ceilingForDefinition` → `resolve` → `toPiToolsAllowlist` from
pi-daddy's build over the seven files as shipped:

```
decide     --tools find,grep,ls,read                 write=no
architect  --tools find,grep,ls,read                 write=no
plan       --tools find,grep,ls,read                 write=no
review     --tools bash,find,grep,ls,read            write=YES (via bash)
debug      --tools bash,find,grep,ls,read            write=YES (via bash)
build      --tools bash,edit,find,grep,ls,read,write write=YES (via bash)
git-ops    --tools bash,read                         write=YES (via bash)

✓ all seven parse, declare, and name only real pi tools
```

The `write=YES (via bash)` column is `expandSubsumed()` on the resolved grant — pi-daddy's own answer
to "what does this ceiling really confer". It is printed rather than hidden because the four that
say `no` are the only ones that structurally cannot modify anything, and that is the claim the
integration rests on.

The two rejected spellings, through the same parser:

```
"Read, Grep, Glob"   → caps=[tool:glob, tool:grep, tool:read]   unknown=[tool:glob]
"Write(docs/**)"     → caps=[]  patterns=[Write(docs/**)]
```

`Glob` survives parsing and dies at the catalog as unknown. `Write(docs/**)` is worse than
"not narrower": it yields **zero** capabilities plus a refusal flag, so the path-scoped ceiling does
not degrade to a broad write — it produces a skill that cannot be spawned at all.

## Rejected: option (a) — real `Write` for the document producers

Giving `decide`, `architect` and `plan` a real `write` was rejected. What it would have cost:

- **It contradicts the framework's stated reason for existing.** `build/SKILL.md` refuses a fix
  applied where the user cannot see it. A plan written to disk by an unwatched subagent is the same
  object.
- **It would have emptied the read-only tier.** Combined with the correction to `review`, *no* skill
  would be read-only — six of seven would hold unrestricted filesystem write, and pi-daddy's grant
  would confer nothing narrower than everything. The handoff's own demo line, *"4 definitions
  spawnable — 3 more need capabilities you do not hold"*, becomes vacuous when the four spawnable
  ones can already overwrite the checkout.
- **It buys nothing the skills asked for.** None of the three bodies names a destination path, so a
  `write`-holding architect would have to *invent* where the ADR goes — a decision the parent holds
  the context to make and the subagent does not.

**Also considered and rejected: gating.** pi-daddy can mark a capability as requiring per-spawn human
approval (`src/resolve.ts:180-182`, `src/approval.ts`), so an operator could let `architect` hold
`write` behind a prompt. Rejected because the gate is per *spawn*, not per *write*: one approval
yields a child with unrestricted write for its entire run. It is a speed bump that trains the
operator to click through, not the path restriction we actually want. It remains available to
operators who choose (a) anyway, and is the right tool for `build` and `git-ops` if an operator wants
one.

## Consequences

- Three of the seven (`plan`, `review`, `debug`) are generated from `contracts/*.md.tmpl`; the
  ceiling is declared there so `SKILL.md` and both `agents/` twins cannot drift.
- Adding a frontmatter key changes each file's word count, so `README.md`'s budget table moves with
  it (`scripts/check-word-budgets.mjs` compares the two exactly).
- Filed against pi-daddy: the handoff table's three defects (`Glob` unknown to pi, `review` needs
  `bash`, `plan`'s `Write`), and a request that `SPEC.md` state the `bash`-subsumes-`write`
  consequence where ceilings are documented.

### Open: the staleness gate counts this as a text change, and it is not one

`npm run lint:skills` goes from **2** stale findings behind a published scorecard cell to **22**.
Measured both ways on this tree — the 2 at `HEAD` are a pre-existing `debug/A6` fixture drift and
have nothing to do with this change; the other 20 are new and are all *"SKILL.md changed since the
newest … run"* against published DeepSeek and GLM cells.

Nothing a model reads changed. The skill bodies are byte-identical; the only edit is one frontmatter
key that no graded run can observe. skill-harness appears to hash the whole `SKILL.md`, so pure
metadata invalidates a behavioral measurement.

pi-daddy solves the same problem in the opposite direction and says why — `digestDefinition` hashes
**the body alone**, because *"a digest that also covered the frontmatter would change when
`description` was reworded and report an instruction change that never happened"*
(`src/definitions.ts:43-49`). That is exactly what has happened here.

Deliberately **not** worked around. Adding these cells to `docs/validation/unpublished-cells.txt`
would break that file's own contract — it covers cells that publish nothing, and these publish
numbers. Re-running the DeepSeek and GLM matrix is real model spend and a scope decision that is the
operator's to make, not a side effect of a metadata edit. So the gate stays red and says why, which
is the behavior the gate was built for.

The durable fix belongs in skill-harness: exclude `allowed-tools` from the staleness hash, or hash
the body and `description` only. `description` genuinely affects skill selection; `allowed-tools`
cannot affect a graded run at all.
