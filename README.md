# principal-pi-skills

**A six-skill framework for principal-level software engineering with an AI coding agent.** Walks a non-trivial change end-to-end — from fuzzy idea to merged PR — by routing the work through six purpose-built skills that hand off to each other with structured "batons." Compatible with any agent that supports the [Agent Skills](https://hochej.github.io/pi-mono/coding-agent/skills/) standard: Claude Code, the Pi coding agent, OpenAI Codex CLI, Amp, Droid, and others. (The "pi" in the name nods to the Pi coding agent — where the `SKILL.md` convention originated — but the framework targets any compliant agent.)

The skills are deliberately opinionated. They enforce postures most agents drop on their own — diverge-before-converge, walking-skeleton-first, anti-sycophancy, read-before-write, scope discipline, honest reporting — and refuse to do work that violates them. The goal is decisions you won't regret in eighteen months, with the artifacts to defend them later.

---

## The pipeline

```
                        ┌─────────────────┐
                        │  brainstorming  │   fuzzy idea → decision brief
                        └────────┬────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
        ┌──────────────────┐    │    ┌───────────────────────┐
        │ software-architect│    │    │ implementation-planner│
        │ design / ADR / C4 │    │    │ plan + DAG + risks    │
        └─────────┬─────────┘    │    └───────────┬───────────┘
                  │              │                │
                  └──────────────┼────────────────┘
                                 ▼
                        ┌────────────────┐
                        │   tech-lead    │   slice → coding spec
                        └────────┬───────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │     coder      │   spec → working code + report
                        └────────┬───────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │  project-git   │   commit, PR, release, recovery
                        └────────────────┘
```

Skills point to each other with **handoff batons** — typed delegation contracts that compress the state the next skill needs. No skill ever invokes another. The orchestrator (you, or your agent harness) routes.

---

## The six skills

**`brainstorming`** is a structured thinking partner, not a solution generator. It walks the user through the Double Diamond — *Discover, Define, Develop, Deliver* — enforcing three competing options minimum (always including "do nothing"), pre-mortems before commitment, and an explicit anti-sycophancy protocol. Output: a decision brief.

**`software-architect`** is a senior solution architect. It works backwards from measurable quality attributes ("sustain 5,000 RPS at p99 < 200ms" — not "scalable"), prefers reversible decisions, refuses premature complexity, and produces C4 diagrams as first-class deliverables (not appendices) on every significant piece of work. Output: design doc, ADR, and the C4 diagrams that go with them.

**`tech-lead`** sits between design and code. It reads the codebase, surfaces conventions and ripple effects, and produces a reviewable coding spec with file paths, function signatures, test cases, edge cases, and reversibility tags. Writes no code. Output: coding spec (or bugfix-spec / refactor-spec) plus handoff baton.

**`implementation-planner`** turns a spec, ADR, or decision brief into an executable plan: walking skeleton first, then vertical INVEST-passing slices in a dependency DAG, with risk register, acceptance + kill criteria per slice, and a status section that updates as work proceeds. Pure planner — points to other skills, never invokes them. Output: implementation plan plus per-transition batons.

**`coder`** is the implementer. Takes a spec (or a direct small task), reads the affected files first, writes tests, implements in small vertical slices, runs the tests, iterates until green, self-reviews, and hands off honestly — naming what worked, what didn't, what was hacky, what was guessed. Output: working code, commits, an implementation report, and a baton to project-git.

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
for s in brainstorming software-architect tech-lead implementation-planner coder project-git; do
  ln -s ~/principal-pi-skills/$s ~/.claude/skills/$s
done

# Or project-level (single repo)
mkdir -p .claude/skills
for s in brainstorming software-architect tech-lead implementation-planner coder project-git; do
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

After installing, your agent should be able to list `brainstorming`, `software-architect`, `tech-lead`, `implementation-planner`, `coder`, and `project-git` as available skills. Triggering any one of them should load only its `SKILL.md`; deeper files in `references/` and `assets/` are loaded on demand via the links inside `SKILL.md`.

---

## Project lifecycle — from idea to merged PR

This is the canonical path. Real work skips ahead, loops back, or enters at the middle; the framework is designed for that. The fully expanded version looks like this.

### 1. Brainstorm the decision

You start with a fuzzy idea: *"Users keep complaining that data exports are slow — should we add a job queue?"* That's a solution-shaped question dressed as a problem. The `brainstorming` skill opens in *Discover* mode, rewinds to the real problem (latency? batch size? blocking the request thread?), generates three to five competing options including "do nothing" and the boring alternative, runs a pre-mortem on the leading candidate, and produces a **decision brief** — the reframed question, surfaced constraints, options considered, the chosen path, its reversibility, and a pointer to the next skill.

The brief is the deliverable. Conversation alone doesn't count.

### 2. Design the system (if needed)

If the decision is large enough that *how to build it* is non-obvious, hand the brief to `software-architect`. The architect elicits **Quality Attribute Scenarios** (concrete, measurable: *"export of 1M rows must complete in under 60 seconds at p95"*), enumerates 2–3 candidate architectures spanning the design space, scores them honestly in a tradeoff matrix, and produces a **design doc** with C4 diagrams at every relevant level — Context, Container, Component (where internal structure matters), Dynamic (for each architecturally-significant scenario), and Deployment (when topology is in play).

If the decision is a single significant choice, the architect writes an **ADR** instead (Nygard, MADR, or Y-statement format) including "do nothing" as a real weighed option and consequences both positive and negative.

For smaller decisions ("should we cache here?"), the architect's *Advisory* mode answers in prose with the decision rule that would flip the recommendation, and you skip straight to step 4.

### 3. Plan the work

`implementation-planner` takes the design (or the brief, for smaller efforts) and turns it into an **executable plan**. The plan opens with a measurable outcome statement, surfaces the top risks before listing any tasks, designs the **walking skeleton** (the thinnest end-to-end slice that exercises every architectural seam with stub logic), then decomposes the rest into **vertical slices** that each pass INVEST — Independent, Negotiable, Valuable, Estimable, Small, Testable.

Every slice has both **acceptance criteria** (done-when) and **kill criteria** (stop-when), plus a reversibility tag — *two-way door* (cheap to undo) or *one-way door* (expensive: schema migrations, public API contracts, vendor commits). One-way doors require explicit kill criteria and a decision review. The plan ships as a dependency DAG, not a sequential checklist, with the critical path called out and parallel work made explicit.

The plan is a living artifact: status updates per slice, dated revision notes, and a handoff baton per skill transition.

### 4. Spec the slice

For each non-trivial slice (anything more than five minutes of thinking before code), `tech-lead` produces a **coding spec**. The lead reads the affected files, runs the baseline tests, surfaces conventions (snake_case? Result types? guard clauses? test layout?), and writes a spec that a coder can execute without making load-bearing decisions themselves.

A line of spec is good when a senior reviewer can answer *yes* to "could a coder execute this without inventing scope?" Bad: *"Add validation."* Good: *"Wrap the request body in `LoginRequest` (a new Zod schema at `src/auth/schemas.ts`); on parse failure, return 400 with `{error: 'invalid_request', field: <first failing path>}`; existing 401 handler unchanged."*

The spec includes a **test plan inside the spec** (not the coder's homework), **flagged assumptions** the coder must reconfirm, **ripple effects** (callers, dependencies, side effects, migrations), reversibility tags on significant decisions, and a **smell-check paragraph**: did this fight the codebase? What sharper seam did we consider?

For bug fixes and refactors, tech-lead uses specialized templates that enforce regression-test-first (bugs) or proof-of-equivalence (refactors).

### 5. Implement the slice

`coder` picks up the spec via the handoff baton. The first action is **reconfirm**, not implement: read the baton's checklist, open the files the spec touches, run the baseline tests, validate that the assumptions still hold. If reality has drifted from the spec, the coder routes back to tech-lead with a specific question rather than silently adapting.

Then implementation: the smallest vertical slice first, test before code (red phase mandatory — a test that never failed proves nothing), commit small with conventional-commits messages, iterate. The coder matches the codebase's conventions, not its own training-data preferences, and stops when blocked rather than suppressing errors with empty catch blocks.

When the slice is done, the coder runs a **fresh-context self-review** as a hostile reviewer, then writes an **honest implementation report**: what worked, what didn't, what's hacky, what was guessed, what was skipped. Sycophantic reporting ("all done!") creates incidents. Honest reporting routes the followup correctly.

### 6. Land it in git

`coder` hands off to `project-git` with a structured baton. project-git runs pre-flight (clean working tree? right branch? remote in sync? authenticated?), commits atomic narrating units (one logical change per commit, imperative subject under 50 chars, body explains *why* not *what*), pushes to the slice branch, opens a PR with a body that explains context-constraints-acceptance for the future reader, and reports back.

In **delegated mode** — the default when called from another skill — project-git suppresses narration and returns a `## Facts` block containing branch name, commit SHAs, PR URL and number, CI status, and a `next_step_hint` for the orchestrator. This is the glue that makes multi-skill pipelines composable end-to-end without losing the IDs and URLs in chat prose.

When CI passes and review approves, project-git executes the merge with the policy the repo expects (rebase, squash, or merge commit) and tags releases per the release-workflow reference when relevant. Recovery, secret-leak response, branch cleanup, and CODEOWNERS / branch-protection setup all live here too.

### 7. Loop back

Most real work loops. A spec assumption breaks; coder routes back to tech-lead. A risk materializes; planner enters **replan** mode (a first-class activity, not a failure). A finding from architectural review needs a brainstorm. The framework names every transition explicitly and produces a baton for each — the alternative is implicit handoffs, which lose state across sessions and lose context across people.

---

## Design philosophy

A handful of patterns recur across the framework. Understanding them is more useful than memorizing any single skill's checklist.

### Tenets, not steps

Each skill opens with a short list of **tenets** — six in brainstorming and architect, eight in implementation-planner, nine in tech-lead and coder, seven in project-git. They describe *posture*, not procedure. The skills explicitly say so: *"these are how you think, not steps to follow."* Working modes give you a sequence to run when one fits; tenets are what you bring to whatever you're doing.

### Working modes, picked by input shape

Every skill has between five and ten **working modes** that map an input shape to a step sequence. Tech-lead's modes range from *"spec from a planner slice"* to *"bug-fix spec"* to *"spec review"* to *"replan mid-flight."* Picking the mode up-front is how the skill keeps you out of the most common AI pitfall: applying the wrong sequence because the request was misread.

### Handoff batons

A baton is a **delegation contract** for a single transition between skills. Not a status update — a typed structure with: the receiving skill's name, a reference to the relevant plan or spec section, inputs and expected postconditions, what's been tried and ruled out, kill criteria for the receiving skill's work, and a return contract. Batons make the pipeline composable: the next skill (or the next session) can pick up without re-reading the entire history. Implementation-planner has Mode F dedicated to *"produce a baton only,"* because writing a good baton is its own craft.

### Reversibility tags

Reversibility is tagged on every significant decision. Decision/design altitude uses two tiers in prose: *two-way door* (cheap to undo) or *one-way door* (data migration, version coordination, downstream breakage, public API change). Code altitude (tech-lead) adds a middle tier — 🟡 *costly* (rework but no migration) — alongside 🟢 *two-way* and 🔴 *one-way* for finer per-decision tagging. One-way doors require an explicit **kill criterion** in advance — *"we revert before further commit if X is observed."* Mid-flight, you can't think clearly about kill criteria; sunk cost has you. Pre-commitment is the whole point.

### Anti-sycophancy as a core posture

The brainstorming skill names this most directly: *"productive disagreement is the goal, not a side effect. If you and the user never disagree in a session, the session probably failed."* The same posture shows up in architect (*"honest tradeoffs — if a recommendation seems to have no downside, you have not thought hard enough"*), tech-lead (*"sycophantic spec review is worse than no review"*), and coder (*"honest reporting beats heroic narration"*). LLMs default toward agreement; the skills push the other way on purpose.

### Read before write

Three skills — tech-lead, coder, and project-git — open with this tenet. You don't spec code you haven't read. You don't write code you haven't read. You don't commit on a working tree you haven't inspected. The seconds spent reading prevent the hours spent unwinding.

### Walking skeleton before depth

Implementation-planner's Tenet 2: *"a walking skeleton is the thinnest possible end-to-end slice that exercises every architectural seam with stub or trivial logic at each node."* Always Step 1 of any non-trivial plan. Vertical slices add depth; horizontal layers (all the models, then all the services, then all the UIs) are forbidden because they defer integration risk to the end.

### Progressive disclosure

A `SKILL.md` carries the posture, the working modes, and the output contract. Deeper craft lives in `references/`. The skill text tells the agent *when* to load each reference — *"if the user has stale, predictable ideas, reach for SCAMPER / see [divergent-techniques.md](references/divergent-techniques.md)."* The agent only pays the context cost when the work actually warrants it.

### Point, don't invoke

Every skill ends with a *Handoff Cues* section that names the next skill but doesn't call it. The text is explicit: *"this skill never invokes another skill."* You — or your harness — route between skills. This keeps each skill independently testable and prevents runaway chains.

*(For the routing question — who actually moves the work between skills — see AGENTS.md §1. In short: the user driving a chat, the agent reading its own previous output, or a programmatic harness all work. The framework targets the first two today; the baton structure is extensible to the third.)*

---

## Skill anatomy

Each skill folder follows the same shape.

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

| Skill                   | Assets | References |
| ----------------------- | -----: | ---------: |
| brainstorming           |      3 |          7 |
| software-architect      |      3 |          7 |
| tech-lead               |      4 |          9 |
| implementation-planner  |      3 |          8 |
| coder                   |      4 |         10 |
| project-git             |      7 |         12 |

---

## Authoring a new skill in this style

If you want to extend the framework, follow the conventions the existing six establish.

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

```
principal-pi-skills/
├── LICENSE
├── README.md                          # this file
├── AGENTS.md                          # instructions for the agent itself
├── brainstorming/
│   ├── SKILL.md
│   ├── assets/      (decision-brief, brainstorm-canvas, premortem-template)
│   └── references/  (cognitive-biases, convergent-evaluation, critical-pressure,
│                     divergent-techniques, facilitation-playbook,
│                     problem-framing, socratic-dialogue)
├── software-architect/
│   ├── SKILL.md
│   ├── assets/      (adr-template, c4-skeletons, design-doc-template)
│   └── references/  (adr-templates, anti-patterns, c4-and-diagrams,
│                     quality-attributes, tech-selection, tradeoff-analysis,
│                     well-architected)
├── tech-lead/
│   ├── SKILL.md
│   ├── assets/      (bugfix-spec, coding-spec, exploration-notes, refactor-spec)
│   └── references/  (anti-patterns, codebase-exploration, convention-discovery,
│                     dependencies-and-ripples, handoff-to-coder,
│                     reversibility-for-code, smell-check, spec-anatomy,
│                     test-strategy)
├── implementation-planner/
│   ├── SKILL.md
│   ├── assets/      (handoff-baton, implementation-plan, risk-register)
│   └── references/  (acceptance-and-kill-criteria, anti-patterns, decomposition,
│                     dependencies-and-sequencing, handoff-contracts,
│                     plan-anatomy, replanning, risk-and-spikes)
├── coder/
│   ├── SKILL.md
│   ├── assets/      (bug-investigation-note, handoff-baton-to-git,
│                     implementation-report, test-plan-checklist)
│   └── references/  (anti-patterns, coding-loops, convention-matching,
│                     debugging-methodology, error-handling, handoff-to-project-git,
│                     read-before-write, scope-discipline, self-review-checklist,
│                     tdd-loop)
└── project-git/
    ├── SKILL.md
    ├── assets/      (codeowners-starter, conventional-commits, gitignore-starters,
                      issue-template-bug, issue-template-chore,
                      issue-template-feature, pr-template)
    └── references/  (actions-and-deployments, branching-strategies, commit-craft,
                      delegation-contract, investigation, issue-craft, pr-craft,
                      rebase-and-merge, recovery, release-workflow, repo-admin,
                      safety-and-secrets)
```

---

## License

MIT © 2026 Nemanja Alavanja. See [LICENSE](./LICENSE).