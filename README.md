# Principal Pi Skills

Five core principal-engineering skills (`architect`, `build`, `review`, `debug`, `git-ops`), three
delegated subagent variants (`agents/principal-{build,review,debug}.md`), and two passive Pi 1.6
extensions (`bootstrap.ts`, `verify-before-settle.ts`) built for fast, low-token coding loops on
256K–512K open-weight and frontier flash models.

- **Zero extra Turn-1 tools:** Both extensions are purely passive (`systemPromptOptions.sections`,
  `tool_call` / `tool_result` hooks, and `before_agent_start` / `agent_end` verification).
- **Cross-OS (macOS / Linux / Windows):** Pure Node.js + Pi extensions; no Linux-only dependencies.
- **Native `pi-daddy` binding:** `principal-agents.json` binds `build`, `review`, and `debug` to
  their verified delegated agent definitions with SHA-256 digests (`pi-daddy >= 1.0.1`).

---

## Install

For the full ecosystem, follow [Pi DaddyΓÇÖs ecosystem quickstart](https://github.com/mojomanyana/pi-daddy#start-here).
It lists the package versions tested together and explains how to update an existing installation.

To install Principal on its own:

```bash
pi install npm:principal-pi-skills
```

If you use the standalone subagents outside Pi Daddy, install and check the agent definitions
with one copy of the latest published helper:

```bash
npm exec --package=principal-pi-skills@latest --call "principal-pi-agents install && principal-pi-agents check"
```

---

## Skills & Delegated Agents

Every word count below is verified by `node scripts/check-word-budgets.mjs`.

| Skill | Purpose | Execution | Words |
|---|---|---|---|
| `architect` | Design structure, boundaries, interfaces, and migrations before large changes | inline | 1357 |
| `build` | Scoped implementation with concrete verification and regression tests | inline or subagent (`agents/principal-build.md`, 1792) | 1739 |
| `review` | Cold, evidence-backed code review of diffs and behavior | subagent (`agents/principal-review.md`, 1450) or inline | 1398 |
| `debug` | Reproduce, isolate root cause, apply minimal fix, add regression test | inline or subagent (`agents/principal-debug.md`, 1469) | 1288 |
| `git-ops` | Safe branching, commit hygiene, release prep, and recovery playbooks | inline | 2536 |

### Workflow Prompts

Slash-command prompts shipped in `prompts/`:
- `/principal-feature <task>` — design/build/verify/review workflow
- `/principal-bugfix <symptom>` — reproduce, root-cause debug, minimal fix, regression test
- `/principal-refactor <scope>` — behavior-preserving refactor with characterization checks
- `/principal-review-branch [base]` — cold branch diff review against `main` (or `[base]`)

---

## Passive Extensions

1. **`extensions/bootstrap.ts`** — Injects `bootstrap/BOOTSTRAP.md` into Pi's structured
   `systemPromptOptions.sections` (preserving provider prompt-cache stability). Reinforces:
   - Concise 3–5 bullet pre-edit micro-plans naming target files and verification commands
   - Batching 3+ read-only file inspections with Pi's native `codemode`
   - Honest reporting of exact observed command output
2. **`extensions/verify-before-settle.ts`** — Passive guardrails during execution:
   - **Workspace boundary guard:** blocks destructive or runaway host scans (e.g. `find /`) outside the project workspace
   - **Deterministic thrash / edit-loop breaker:** detects repeated identical test failures (`sameFailCount >= 2`), injects a root-cause recovery steer, and emits `principal:thrash-detected:v1` on `pi.events` (consumed by `pi-daddy` Smart Auto-Escalation)
   - **Verify-before-settle:** reminds the agent to run verification after edits before claiming completion

---

## Repository Layout

```text
architect/SKILL.md            inline architecture & design skill
build/SKILL.md                implementation skill (generated from contracts/build.md.tmpl)
review/SKILL.md               cold review skill (generated from contracts/review.md.tmpl)
debug/SKILL.md                debugging skill (generated from contracts/debug.md.tmpl)
git-ops/SKILL.md              git safety & release skill
agents/principal-*.md         delegated agent definitions for build, review, debug
principal-agents.json         SHA-256 binding manifest for pi-daddy
bootstrap/BOOTSTRAP.md        concise session operating habits (195 words)
extensions/bootstrap.ts       structured system-prompt section injector
extensions/verify-before-settle.ts  workspace guard, thrash detector, verification hook
prompts/principal-*.md        workflow slash-command prompts
references/                   shared research & checkpoint references
scripts/                      contract generator, linter, pack check, word-budget check, CLI bins
```

---

## Development

```bash
npm run generate       # regenerate skills, agents, prompts, and principal-agents.json from contracts/
npm test               # generate:check + unit tests + install tests + check:pack + lint:skills
node scripts/check-word-budgets.mjs
```
