---
name: review-perf
metadata:
  principal-package: principal-pi-skills
description: >
  Use when auditing code or diffs for performance bottlenecks, algorithmic complexity,
  concurrency hazards, race conditions, deadlocks, memory/handle leaks, or unbounded I/O.
allowed-tools: read, grep, find, ls, codemode, parallel, scout_brief_read, bookie_search, bookie_read, bookie_propose_memory, context:files
---

# Review-Perf — Performance & Concurrency Audit

Perform a read-only performance, scaling, and concurrency review of the target files or diff.
Batch parallel reads with `codemode` or `parallel`. Report concrete defects with file/line
citations—skip speculative micro-optimizations.

## Audit Focus
- **Concurrency & Races:** Shared mutable state across async hops, lost updates, lock
  contention, unhandled rejection chains, or missing cancellation/abort cleanup.
- **Resource & Handle Lifecycles:** Unclosed file descriptors, leaked timers/sockets/listeners,
  orphaned child processes, or unbounded caches/buffers.
- **Latency & Scaling:** Accidental O(n^2) loops on hot paths, synchronous blocking I/O in
  event hooks, redundant disk/git/network calls, or serialized work that should run concurrently.

## Output
- Verdict: `PASS` or `FAIL`
- Concrete `[BLOCKER]` findings with `file:line`, failure/scaling scenario, and minimal fix.
- Measured vs inferred impact clearly distinguished.
