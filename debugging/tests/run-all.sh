#!/usr/bin/env bash
#
# run-all.sh — batch-run debugging scenarios through a runner and save transcripts.
# Picks the runner via RUNNER (pi|claude); prompts come from cases.sh inside the runner.
#
# Usage: ./run-all.sh [mode] [scenario ...]    mode: green(default)|red|both|force
# Env:
#   RUNNER=pi|claude            (default pi)
#   (pi)     PIPROV, PIMODEL
#   (claude) CMODEL=opus|sonnet|haiku   — uses your Max plan, no API billing
#   SKILL, PITHINK, VERBOSE
#   DRYRUN=1                    stub everything, no model calls
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unset INTERACTIVE   # batch must auto-chain multi-turn, never wait for a paste

RUNNER="${RUNNER:-pi}"
export SKILL="${SKILL:-$(cd "$here/.." && pwd)}"   # the skill dir = parent of tests/
case "$RUNNER" in
  pi)     runner="$here/run-pi.sh";     export PIPROV="${PIPROV:-fireworks}" PIMODEL="${PIMODEL:-accounts/fireworks/models/deepseek-v4-pro}"; modelid="$PIMODEL"; rlabel="pi/$PIPROV";;
  claude) runner="$here/run-claude.sh"; export CMODEL="${CMODEL:-opus}"; modelid="claude-$CMODEL"; rlabel="claude(Max)";;
  *) echo "error: unknown RUNNER '$RUNNER' (pi|claude)" >&2; exit 1;;
esac
[ -n "${PITHINK:-}" ] && export PITHINK
[ -n "${VERBOSE:-}" ] && export VERBOSE

ALL="A1 A2 A3 A4 B1 C1"
mode="${1:-green}"; [ $# -gt 0 ] && shift
case "$mode" in
  green) modes=(green);; red) modes=(red);; both) modes=(red green);; force) modes=(force);;
  -h|--help|help) echo "usage: ./run-all.sh [green|red|both|force] [scenario ...]"; exit 0;;
  *) echo "error: unknown mode '$mode' (green|red|both|force)" >&2; exit 1;;
esac
scenarios="${*:-$ALL}"

mkdir -p "$here/results"
[ -f "$here/results/.gitignore" ] || printf '*\n!.gitignore\n' > "$here/results/.gitignore"
modeltag="$(printf '%s' "$modelid" | tr '/ :' '___')"
stamp="$(date +%Y%m%d-%H%M%S)"
outdir="$here/results/$modeltag/$stamp"; mkdir -p "$outdir"
summary="$outdir/SUMMARY.txt"; : > "$summary"

n=0; for m in "${modes[@]}"; do for s in $scenarios; do n=$((n + 1)); done; done
echo "================================================================"
echo " runner    : $rlabel    model: $modelid"
echo " modes     : ${modes[*]}    scenarios: $scenarios"
echo " runs      : $n    output: results/$modeltag/$stamp"
[ "${DRYRUN:-}" = "1" ] && echo " DRYRUN    : on (no model calls)"
echo "================================================================"
[ "${DRYRUN:-}" != "1" ] && echo "(Ctrl-C to abort — this makes live model calls.)" && echo ""

ok=0; fail=0
for m in "${modes[@]}"; do
  for s in $scenarios; do
    f="$outdir/${s}.${m}.txt"
    printf "  %-3s %-6s ... " "$s" "$m"
    if [ "${DRYRUN:-}" = "1" ]; then
      printf '[dry-run] %s %s %s\n' "$RUNNER" "$s" "$m" > "$f"
      echo "dry-run"; echo "DRY  $s $m" >> "$summary"; ok=$((ok + 1)); continue
    fi
    if "$runner" "$s" "$m" > "$f" 2>&1; then
      echo "ok"; echo "ok   $s $m" >> "$summary"; ok=$((ok + 1))
    else
      echo "FAILED (see ${f##*/})"; echo "FAIL $s $m" >> "$summary"; fail=$((fail + 1))
    fi
  done
done

echo ""
echo "  done: $ok ok, $fail failed"
echo "  transcripts: $outdir"
