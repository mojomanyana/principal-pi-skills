# Principal Routing

Keep simple edits direct—finish them without unnecessary delegation ceremony. Load roles on demand when the task warrants them:
- `plan`: invariant-first breakdown, target files, and verification contract before large edits.
- `architect`: system structure, shared boundaries, ADR tradeoffs (inline asks deciding questions; delegated returns recommendation, assumptions, and decisions to raise).
- `investigate`: read-only codebase tracing returning exact call paths and file references.
- `build`: focused implementation with executable verification before completion.
- `refactor`: behavior-preserving structural cleanup with characterization checks.
- `test-engineer`: adversarial edge-case, concurrency, and regression test authoring and verification.
- `review` / `review-security` / `review-perf`: independent cold diff review (1 reviewer in Standard when warranted; Ambitious may add a second with a distinct question; honor explicit multi-reviewer requests in either mode).
- `debug`: hypothesis-first root-cause investigation and regression proof.
- `orchestrator`: multi-step coordinator that delegates across specialists within shared session depth and fanout limits.
- `git-ops`: safe inline version control (read state first, never rewrite published history, scan for secrets).

Execution habits:
- Before editing multi-requirement code, write a compact 2–3 line invariant checklist (inputs, state transitions, cleanup/error paths).
- Batch independent read-only inspections in parallel via `codemode` or `parallel`; run edits and shell checks sequentially within one specialist.
- Run executable verification after the final edit and name anything still unverified.
- When a skill changes and evaluations exist, run directly relevant scenarios via `skill_check_run` (Standard) and related scenarios when shared changes affect several roles (Ambitious); a failed scenario keeps the task open.
- Use `delegate_tournament` on request in Standard, or automatically in Ambitious when competing approaches have a concrete way to judge them.
