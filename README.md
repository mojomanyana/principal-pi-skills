# principal-pi-skills

**A ten-skill framework for principal-level software engineering with an AI coding agent.** Walks a non-trivial change end-to-end — from fuzzy idea to merged PR — by routing the work through purpose-built skills that hand off to each other with structured "batons." A routing-index skill (`using-principal-pi-skills`) carries the shared posture and points each task at the right worker. Compatible with any agent that supports the [Agent Skills](https://hochej.github.io/pi-mono/coding-agent/skills/) standard: Claude Code, the Pi coding agent, OpenAI Codex CLI, Amp, Droid, and others. (The "pi" in the name nods to the Pi coding agent — where the `SKILL.md` convention originated — but the framework targets any compliant agent.)

The skills are deliberately opinionated. They enforce postures most agents drop on their own — diverge-before-converge, walking-skeleton-first, anti-sycophancy, read-before-write, scope discipline, honest reporting — and refuse to do work that violates them. The goal is decisions you won't regret in eighteen months, with the artifacts to defend them later.

---

## The flow

```
brainstorming → implementation-planner → coder → [ ponytail · code-review ] → project-git
                     ▲ software-architect (+ adr)        validate gate              ▼ debugging
                       — entered only when architectural —                      (when it breaks)
```

Most tasks walk the spine. The design tier (`software-architect` + `adr`) is entered only for architectural calls; the repair loop (`debugging`) is entered only when something fails; the validate gate (`ponytail` + `code-review`) runs before anything lands. `using-principal-pi-skills` sits above all of this as the routing index — read it first to adopt the posture and pick the right skill.

The framework has **three shapes**, and flattening them loses the point:

- **Pipeline** — `brainstorming → implementation-planner → coder → project-git`: the sequential spine, baton to baton.
- **Sidekicks / gate** — `ponytail` (simplicity) and `code-review` (correctness): two critics that review what `coder` produced before it lands. They review and recommend; they don't build.
- **Depth & repair** — `software-architect` (+ `adr`) entered for architectural calls; `debugging` entered when something fails. Visited as needed, not on every task.

Skills point to each other with **handoff batons** — typed delegation contracts that compress the state the next skill needs. No skill ever invokes another. The orchestrator (you, or your agent harness) routes.

---

## The ten skills

**`using-principal-pi-skills`** is the map, not a worker. It carries the shared principal-engineer posture every skill inherits — *smallest thing that works, evidence over assertion, reversible by default, honest over agreeable, right-size the ceremony* — and a routing table from situation to skill. Read it first to orient a multi-step task; skip it in a single-skill run, where each skill stands alone.

**`brainstorming`** is a structured thinking partner, not a solution generator. It walks the user through the Double Diamond — *Discover, Define, Develop, Deliver* — enforcing three competing options minimum (always including "do nothing"), pre-mortems before commitment, and an explicit anti-sycophancy protocol. Output: a decision brief.

**`software-architect`** is a senior solution architect. It works backwards from measurable quality attributes ("sustain 5,000 RPS at p99 < 200ms" — not "scalable"), prefers reversible decisions, refuses premature complexity, and produces C4 diagrams as first-class deliverables (not appendices) on every significant piece of work. Output: design doc plus the C4 diagrams that go with it. Entered only when the work is architectural.

**`adr`** records *why* a significant or irreversible decision was made, so the reasoning survives. It forces the trigger ("what makes this decision necessary now?"), states the forces in tension, enumerates real options including "do nothing", and writes consequences both positive and negative. Split out of `software-architect`, which makes the decision; this skill captures it. Output: an Architecture Decision Record.

**`implementation-planner`** turns a decision, ADR, or spec into an executable plan — *and* a coder-ready spec for each slice. It reads the codebase, designs the walking skeleton first, then decomposes into vertical INVEST-passing slices in a dependency DAG with a risk register and acceptance + kill criteria per slice; and for each slice produces the code-level spec — file paths, signatures, test cases, edge cases, ripple effects, reversibility tags — that a coder can execute without making load-bearing decisions. (This is the role the former `tech-lead` skill owned, now merged in: exploration notes, coding-spec, bugfix-spec, refactor-spec, and the handoff baton to coder all live here.) Writes no code — points to other skills, never invokes them. Output: implementation plan, per-slice specs, and per-transition batons.

**`coder`** is the implementer. Takes a spec (or a direct small task), reads the affected files first, writes tests, implements in small vertical slices, runs the tests, iterates until green, self-reviews, runs the validate gate (`ponytail` then `code-review`), and hands off honestly — naming what worked, what didn't, what was hacky, what was guessed. Output: working code, commits, an implementation report, and a baton to project-git.

**`ponytail`** is the simplicity sidekick — a skeptical senior-dev second opinion that cuts bloat and questions whether code needs to exist at all (reuse beats build, no abstraction for one caller, delete is a feature). It reviews what `coder` produced before it lands; it owns minimality, not correctness. Reviews and recommends — it doesn't build. Output: a simplicity review.

**`code-review`** is the correctness gate before a change lands. It hunts the failure modes the diff is silent about — empty/null/boundary inputs, the error path, swallowed errors, weak tests, security and data issues — ranked by severity (blocker / should-fix / nit), verified not assumed. Pairs with `ponytail`; this one owns correctness. Reviews and recommends — it doesn't build. Output: a severity-ranked review.

**`debugging`** is the repair loop, entered when something fails — a red test, a stack trace, a flaky bug. It works *reproduce → isolate → hypothesize → probe → fix-and-verify*, fixes at the root cause not the symptom, requires a regression test that fails before the fix, and refuses to swallow the error. Output: a verified fix and a handoff back to `coder` (or `implementation-planner`, if it's a design problem).

**`project-git`** is the senior git/GitHub operator. Handles commits, branches, rebases, PRs, issues, releases, CI reading, and recovery. Supports a **delegated mode** that suppresses narration and returns a `## Facts` block (URLs, IDs, SHAs) so upstream skills or scripts can act on the result. Refuses force-push to protected branches, scans for secrets before commit, walks the reflog before destructive ops.

---

## Quick start

Each skill is a standalone folder containing a `SKILL.md` with frontmatter, an `assets/` directory of fillable templates, and a `references/` directory of progressive-disclosure deep dives. Most agents auto-discover skills from one or more known directories.

Pick your agent and install.

### Claude Code

```bash
# Clone somewhere convenient
git clone https://github.com/mojomanyana/principal-pi-skills ~/principal-pi-skills

# User-level (available in every project)
mkdir -p ~/.claude/skills
for s in using-principal-pi-skills brainstorming software-architect adr \
         implementation-planner coder ponytail code-review debugging project-git; do
  ln -s ~/principal-pi-skills/$s ~/.claude/skills/$s
done

# Or project-level (single repo)
mkdir -p .claude/skills
for s in using-principal-pi-skills brainstorming software-architect adr \
         implementation-planner coder ponytail code-review debugging project-git; do
  ln -s ~/principal-pi-skills/$s .claude/skills/$s
done
```

Claude Code looks one level deep for `SKILL.md`, so each skill must sit directly under the `skills/` directory — symlinks are simplest.

### Pi coding agent

```bash
# User-level
git clone https://github.com/mojomanyana/principal-pi-skills ~/.pi/agent/skills/principal-pi-skills

# Or project-level
git clone https://github.com/mojomanyana/principal-pi-skills .pi/skills/principal-pi-skills
```

Pi discovers skills recursively under any registered `skills/` directory and resolves `SKILL.md` from subfolders.

### OpenAI Codex CLI / Amp / Droid

```bash
# Codex
git clone https://github.com/mojomanyana/principal-pi-skills ~/.codex/skills/principal-pi-skills

# Droid
git clone https://github.com/mojomanyana/principal-pi-skills ~/.factory/skills/principal-pi-skills
```

Adjust paths to match your tool's convention. Any agent supporting the Agent Skills standard reads the YAML frontmatter (`name`, `description`) and decides when to load each skill from the description text.

### Verify

After installing, your agent should be able to list `using-principal-pi-skills`, `brainstorming`, `software-architect`, `adr`, `implementation-planner`, `coder`, `ponytail`, `code-review`, `debugging`, and `project-git` as available skills. Triggering any one of them should load only its `SKILL.md`; deeper files in `references/` and `assets/` are loaded on demand via the links inside `SKILL.md`.

---

## Project lifecycle — from idea to merged PR

This is the canonical path. Real work skips ahead, loops back, or enters at the middle; the framework is designed for that. The fully expanded version looks like this.

### 1. Brainstorm the decision

You start with a fuzzy idea: *"Users keep complaining that data exports are slow — should we add a job queue?"* That's a solution-shaped question dressed as a problem. The `brainstorming` skill opens in *Discover* mode, rewinds to the real problem (latency? batch size? blocking the request thread?), generates three to five competing options including "do nothing" and the boring alternative, runs a pre-mortem on the leading candidate, and produces a **decision brief** — the reframed question, surfaced constraints, options considered, the chosen path, its reversibility, and a pointer to the next skill.

The brief is the deliverable. Conversation alone doesn't count.

### 2. Design the system (if needed)

If the decision is large enough that *how to build it* is non-obvious, hand the brief to `software-architect`. The architect elicits **Quality Attribute Scenarios** (concrete, measurable: *"export of 1M rows must complete in under 60 seconds at p95"*), enumerates 2–3 candidate architectures spanning the design space, scores them honestly in a tradeoff matrix, and produces a **design doc** with C4 diagrams at every relevant level — Context, Container, Component (where internal structure matters), Dynamic (for each architecturally-significant scenario), and Deployment (when topology is in play).

If the decision is a single significant or irreversible choice, hand it to the `adr` skill, which records *why* it was made (Nygard, MADR, or Y-statement format) including "do nothing" as a real weighed option and consequences both positive and negative — so the reasoning survives even after the people who made it move on.

For smaller decisions ("should we cache here?"), the architect's *Advisory* mode answers in prose with the decision rule that would flip the recommendation, and you skip straight to implementation.

### 3. Plan the work and spec the slices

`implementation-planner` takes the design (or the brief, for smaller efforts) and turns it into an **executable plan** — *and*, for each slice, a coder-ready spec. The plan opens with a measurable outcome statement, surfaces the top risks before listing any tasks, designs the **walking skeleton** (the thinnest end-to-end slice that exercises every architectural seam with stub logic), then decomposes the rest into **vertical slices** that each pass INVEST — Independent, Negotiable, Valuable, Estimable, Small, Testable.

Every slice has both **acceptance criteria** (done-when) and **kill criteria** (stop-when), plus a reversibility tag — *two-way door* (cheap to undo) or *one-way door* (expensive: schema migrations, public API contracts, vendor commits). One-way doors require explicit kill criteria and a decision review. The plan ships as a dependency DAG, not a sequential checklist, with the critical path called out and parallel work made explicit. The plan is a living artifact: status updates per slice, dated revision notes, and a handoff baton per skill transition.

Then, for each non-trivial slice (anything more than five minutes of thinking before code), the planner reads the affected files, runs the baseline tests, surfaces conventions (snake_case? Result types? guard clauses? test layout?), and produces a **coding spec** a coder can execute without making load-bearing decisions themselves. (This is the work the former `tech-lead` skill did, now merged into the planner.) A line of spec is good when a senior reviewer can answer *yes* to "could a coder execute this without inventing scope?" Bad: *"Add validation."* Good: *"Wrap the request body in `LoginRequest` (a new Zod schema at `src/auth/schemas.ts`); on parse failure, return 400 with `{error: 'invalid_request', field: <first failing path>}`; existing 401 handler unchanged."*

The spec includes a **test plan inside the spec** (not the coder's homework), **flagged assumptions** the coder must reconfirm, **ripple effects** (callers, dependencies, side effects, migrations), reversibility tags on significant decisions, and a **smell-check paragraph**: did this fight the codebase? What sharper seam did we consider? For bug fixes and refactors, the planner uses specialized templates that enforce regression-test-first (bugs) or proof-of-equivalence (refactors).

### 4. Implement the slice

`coder` picks up the spec via the handoff baton. The first action is **reconfirm**, not implement: read the baton's checklist, open the files the spec touches, run the baseline tests, validate that the assumptions still hold. If reality has drifted from the spec, the coder routes back to `implementation-planner` with a specific question rather than silently adapting.

Then implementation: the smallest vertical slice first, test before code (red phase mandatory — a test that never failed proves nothing), commit small with conventional-commits messages, iterate. The coder matches the codebase's conventions, not its own training-data preferences, and stops when blocked rather than suppressing errors with empty catch blocks. If the failure is an *unknown* one — a mysterious red test or crash — the coder routes to `debugging` rather than guessing.

When the slice is done, the coder runs a **fresh-context self-review** as a hostile reviewer, then writes an **honest implementation report**: what worked, what didn't, what's hacky, what was guessed, what was skipped. Sycophantic reporting ("all done!") creates incidents. Honest reporting routes the followup correctly.

### 5. Validate before it lands

Before a non-trivial diff lands, it passes the **validate gate** — two critics that review what `coder` produced. `ponytail` runs the **simplicity pass**: does this code need to exist at all, is anything over-engineered, can it be deleted or replaced with something already present? `code-review` runs the **correctness pass**: bugs, edge cases, swallowed errors, weak tests, security and data issues — ranked blocker / should-fix / nit, verified not assumed. Both review and recommend; neither builds. The coder applies what they surface, then proceeds.

### 6. Land it in git

`coder` hands off to `project-git` with a structured baton. project-git runs pre-flight (clean working tree? right branch? remote in sync? authenticated?), commits atomic narrating units (one logical change per commit, imperative subject under 50 chars, body explains *why* not *what*), pushes to the slice branch, opens a PR with a body that explains context-constraints-acceptance for the future reader, and reports back.

In **delegated mode** — the default when called from another skill — project-git suppresses narration and returns a `## Facts` block containing branch name, commit SHAs, PR URL and number, CI status, and a `next_step_hint` for the orchestrator. This is the glue that makes multi-skill pipelines composable end-to-end without losing the IDs and URLs in chat prose.

When CI passes and review approves, project-git executes the merge with the policy the repo expects (rebase, squash, or merge commit) and tags releases per the release-workflow reference when relevant. Recovery, secret-leak response, branch cleanup, and CODEOWNERS / branch-protection setup all live here too.

### 7. Loop back

Most real work loops. A spec assumption breaks; coder routes back to `implementation-planner`. An unknown failure surfaces; coder hands to `debugging`, which fixes and returns. A risk materializes; the planner enters **replan** mode (a first-class activity, not a failure). A finding from architectural review needs a brainstorm. The framework names every transition explicitly and produces a baton for each — the alternative is implicit handoffs, which lose state across sessions and lose context across people.

---

## Design philosophy

A handful of patterns recur across the framework. Understanding them is more useful than memorizing any single skill's checklist.

### Tenets, not steps

Most skills open with a short list of **tenets** — six in brainstorming, architect, and code-review; nine in implementation-planner and coder; seven in project-git; five in ponytail. (`adr` and `debugging` lead with a numbered discipline / phase loop rather than a tenet list; `using-principal-pi-skills` carries the shared posture all the others inherit.) Tenets describe *posture*, not procedure. The skills explicitly say so: *"these are how you think, not steps to follow."* Working modes give you a sequence to run when one fits; tenets are what you bring to whatever you're doing.

### Working modes, picked by input shape

Most skills have several **working modes** that map an input shape to a step sequence. Implementation-planner's modes range from *"plan from a decision brief"* to *"spec a single slice"* to *"bug-fix spec"* to *"replan mid-flight"* to *"produce a baton only."* Picking the mode up-front is how the skill keeps you out of the most common AI pitfall: applying the wrong sequence because the request was misread.

### Handoff batons

A baton is a **delegation contract** for a single transition between skills. Not a status update — a typed structure with: the receiving skill's name, a reference to the relevant plan or spec section, inputs and expected postconditions, what's been tried and ruled out, kill criteria for the receiving skill's work, and a return contract. Batons make the pipeline composable: the next skill (or the next session) can pick up without re-reading the entire history. Implementation-planner has a mode dedicated to *"produce a baton only,"* because writing a good baton is its own craft.

### Reversibility tags

Reversibility is tagged on every significant decision. Decision/design altitude (brainstorming, software-architect, adr) uses two tiers in prose: *two-way door* (cheap to undo) or *one-way door* (data migration, version coordination, downstream breakage, public API change). Code altitude (implementation-planner, on each slice) adds a middle tier — 🟡 *costly* (rework but no migration) — alongside 🟢 *two-way* and 🔴 *one-way* for finer per-decision tagging. One-way doors require an explicit **kill criterion** in advance — *"we revert before further commit if X is observed."* Mid-flight, you can't think clearly about kill criteria; sunk cost has you. Pre-commitment is the whole point.

### Anti-sycophancy as a core posture

The brainstorming skill names this most directly: *"productive disagreement is the goal, not a side effect. If you and the user never disagree in a session, the session probably failed."* The same posture shows up in architect (*"honest tradeoffs — if a recommendation seems to have no downside, you have not thought hard enough"*), code-review (*"a rubber-stamp ('LGTM') is worse than no review: it launders risk"*), and coder (*"honest reporting beats heroic narration"*). The shared posture in `using-principal-pi-skills` states it as a tenet: *honest over agreeable — surface the risk, push back on the unsound, don't rubber-stamp.* LLMs default toward agreement; the skills push the other way on purpose.

### Read before write

Three skills — implementation-planner, coder, and project-git — open with this tenet. You don't plan or spec code you haven't read. You don't write code you haven't read. You don't commit on a working tree you haven't inspected. The seconds spent reading prevent the hours spent unwinding.

### Walking skeleton before depth

Implementation-planner's walking-skeleton tenet: *"the thinnest end-to-end slice that exercises every seam (pipeline, auth, data, integration) with stub logic."* Always Step 1 of any non-trivial plan. Vertical slices add depth; horizontal layers (all the models, then all the services, then all the UIs) are forbidden because they defer integration risk to the end.

### Progressive disclosure

A `SKILL.md` carries the posture, the working modes, and the output contract. Deeper craft lives in `references/`. The skill text tells the agent *when* to load each reference — *"if the user has stale, predictable ideas, reach for SCAMPER / see [divergent-techniques.md](references/divergent-techniques.md)."* The agent only pays the context cost when the work actually warrants it.

### Point, don't invoke

Every skill ends with a *Handoff Cues* section that names the next skill but doesn't call it. The text is explicit: *"this skill never invokes another skill."* You — or your harness — route between skills. This keeps each skill independently testable and prevents runaway chains.

*(For the routing question — who actually moves the work between skills — see AGENTS.md §1. In short: the user driving a chat, the agent reading its own previous output, or a programmatic harness all work. The framework targets the first two today; the baton structure is extensible to the third.)*

---

## Skill anatomy

Each skill folder follows the same shape. The heavier skills carry `assets/` and `references/`; the lean critics (`ponytail`, `code-review`) and the routing index (`using-principal-pi-skills`) are a single self-contained `SKILL.md`.

```
<skill-name>/
├── SKILL.md              # Frontmatter (name, description) + posture, modes, output contract
├── assets/               # Fillable markdown templates the skill produces
│   ├── *.md              # e.g. decision-brief.md, coding-spec.md, handoff-baton.md
└── references/           # Progressive-disclosure deep dives, loaded on demand
    └── *.md              # e.g. cognitive-biases.md, c4-and-diagrams.md, recovery.md
```

The frontmatter is the most important line of code in the skill — it's what your agent reads to decide whether to load the skill. The `description` field is written for trigger detection: it lists the phrases and intents that should activate the skill, including ones that don't use the skill's name. From brainstorming: *"Trigger even when the user doesn't say 'brainstorm' — if they're exploring rather than executing, this skill applies."*

`assets/` files are templates with placeholders the skill fills in. `references/` files are deeper craft documents the skill *links* to inside `SKILL.md` — the agent loads them only when the linked context fires.

The full layout in this repo:

| Skill                     | Assets | References |
| ------------------------- | -----: | ---------: |
| using-principal-pi-skills |      0 |          0 |
| brainstorming             |      4 |          9 |
| software-architect        |      3 |          8 |
| adr                       |      1 |          1 |
| implementation-planner    |      7 |         16 |
| coder                     |      4 |          9 |
| ponytail                  |      0 |          0 |
| code-review               |      0 |          0 |
| debugging                 |      0 |          1 |
| project-git               |      7 |         12 |

---

## Authoring a new skill in this style

If you want to extend the framework, follow the conventions the existing skills establish.

1. **Pick a single job.** Skills are sharp tools. A "general engineering helper" is not a skill; "review an ADR" is. If your draft skill description starts with *"helps with..."*, it's too broad.
2. **Write the description for trigger detection, not for humans.** List the phrases, including the indirect ones. Brainstorming triggers on *"I'm thinking about"* and *"should I"* — the user rarely says "brainstorm."
3. **Start with tenets.** Three to nine numbered postures. Each one should be defensible against a counterexample.
4. **Define working modes.** Map input shapes to step sequences. Cover the boring path, the recovery path, and at least one review/replan path.
5. **Name the output artifact.** A markdown template in `assets/`. The artifact is the deliverable; the chat conversation is not.
6. **Write the handoff cues.** Which skill takes the artifact next, and what the baton must carry.
7. **Push the depth into `references/`.** Keep `SKILL.md` under a thousand lines; link out for the rest.
8. **Add refusal rules.** What the skill refuses to do — vague requests, scope creep, premature solutions. Refusals are how a skill maintains posture under pressure.

---

## Repo layout

Every worker skill also carries a `tests/specification.yaml` (see *Testing*, below). The routing index is `SKILL.md`-only.

```
principal-pi-skills/
├── LICENSE
├── README.md                          # this file
├── AGENTS.md                          # instructions for the agent itself
├── CHANGELOG.md
├── using-principal-pi-skills/
│   └── SKILL.md                       # posture + routing index (no assets/references)
├── brainstorming/
│   ├── SKILL.md
│   ├── assets/      (brainstorm-canvas, decision-brief, handoff-baton,
│   │                 premortem-template)
│   ├── references/  (cognitive-biases, convergent-evaluation, critical-pressure,
│   │                 divergent-techniques, double-diamond, facilitation-playbook,
│   │                 problem-framing, socratic-dialogue, technique-selection)
│   └── tests/       (specification.yaml)
├── software-architect/
│   ├── SKILL.md
│   ├── assets/      (c4-skeletons, design-doc-template, handoff-baton)
│   ├── references/  (anti-patterns, c4-and-diagrams, onboarding, quality-attributes,
│   │                 tech-debt-triage, tech-selection, tradeoff-analysis,
│   │                 well-architected)
│   └── tests/       (specification.yaml)
├── adr/
│   ├── SKILL.md
│   ├── assets/      (adr-template)
│   ├── references/  (adr-templates)
│   └── tests/       (specification.yaml)
├── implementation-planner/            # plan + per-slice spec (former tech-lead merged in)
│   ├── SKILL.md
│   ├── assets/      (bugfix-spec, coding-spec, exploration-notes, handoff-baton,
│   │                 implementation-plan, refactor-spec, risk-register)
│   ├── references/  (acceptance-and-kill-criteria, anti-patterns, codebase-exploration,
│   │                 convention-discovery, decomposition, dependencies-and-ripples,
│   │                 dependencies-and-sequencing, handoff-contracts, handoff-to-coder,
│   │                 plan-anatomy, replanning, reversibility-for-code, risk-and-spikes,
│   │                 smell-check, spec-anatomy, test-strategy)
│   └── tests/       (specification.yaml)
├── coder/
│   ├── SKILL.md
│   ├── assets/      (bug-investigation-note, handoff-baton-to-git,
│   │                 implementation-report, test-plan-checklist)
│   ├── references/  (anti-patterns, coding-loops, convention-matching, error-handling,
│   │                 handoff-to-project-git, read-before-write, scope-discipline,
│   │                 self-review-checklist, tdd-loop)
│   └── tests/       (specification.yaml, fixtures/)
├── ponytail/                          # simplicity sidekick (SKILL.md only)
│   ├── SKILL.md
│   └── tests/       (specification.yaml)
├── code-review/                       # correctness gate (SKILL.md only)
│   ├── SKILL.md
│   └── tests/       (specification.yaml)
├── debugging/
│   ├── SKILL.md
│   ├── references/  (debugging-methodology)
│   └── tests/       (specification.yaml, fixtures/)
└── project-git/
    ├── SKILL.md
    ├── assets/      (codeowners-starter, conventional-commits, gitignore-starters,
    │                 issue-template-bug, issue-template-chore,
    │                 issue-template-feature, pr-template)
    ├── references/  (actions-and-deployments, branching-strategies, commit-craft,
    │                 delegation-contract, investigation, issue-craft, pr-craft,
    │                 rebase-and-merge, recovery, release-workflow, repo-admin,
    │                 safety-and-secrets)
    └── tests/       (specification.yaml)
```

---

## Testing

Each worker skill ships **one declarative `tests/specification.yaml`** — a set of scenarios describing the posture the skill should hold (the right refusal, the right routing, the right artifact) rather than a script of exact strings. A separate **`skill-check`** tool runs the specs against an agent loaded with the skill; the per-skill bash harnesses the framework used to carry have been removed in favour of this single declarative format.

---

## License

MIT © 2026 Nemanja Alavanja. See [LICENSE](./LICENSE).