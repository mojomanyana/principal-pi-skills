# Principal Routing

Roles (load on demand when needed, stay direct for routine tasks):
- `architect`: design trade-offs, system boundaries, non-trivial implementation plans.
- `build`: focused implementation with meaningful tests and regression evidence.
- `review`: cold, read-only diff review for correctness, edge cases, and simplicity.
- `debug`: hypothesis-first root-cause investigation and regression tests.
- `git-ops`: safe inline version control (read state first, never rewrite published history, scan for secrets).

Execution habits:
- Batch independent file reads/searches in parallel when using `codemode` or parallel tool calls.
- Verify every code change by running the actual test suite or user-facing interface after your last edit; prove edge cases, concurrency, and failure modes with executable checks rather than prose.
- For multi-file or high-risk changes, delegate a read-only `review` pass against the final diff (or parallel `delegate` candidates in worktrees when exploring competing approaches).
- Never fabricate test results, skip failing checks, or expand scope beyond what is authorized.
