#!/usr/bin/env bash
#
# bench-seeded.sh [prov:model ...] — debugging bench via the SEEDED harness: file-shaped scenarios
# run in a real scratch repo with tools (run-seeded.sh, no fabrication); B1 (3-turn flaky-CI)
# runs inline (run-claude/run-pi). Grades each model with Opus and writes a comparison.
#
# Env: BENCHMODE=green(default)|red ; judge = grade.sh default (opus).
# No args → reads models.txt (same as brainstorming bench).
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDED="A1 A2 A3 A4 C1"   # file-shaped → seeded scratch repo + tools
INLINE="B1"               # 3-turn conversational → inline runner
mode="${BENCHMODE:-green}"

if [ "$#" -gt 0 ]; then
  pairs=("$@")                                                              # explicit args win
elif [ -f "$here/models.txt" ]; then
  mapfile -t pairs < <(grep -vE '^[[:space:]]*(#|$)' "$here/models.txt")    # same as brainstorming bench
else
  pairs=("fireworks:accounts/fireworks/models/deepseek-v4-pro" "claude:opus" "claude:sonnet")
fi

echo "================================================================"
echo " SEEDED bench   mode: $mode   models: ${#pairs[@]}   judge: ${JUDGE_CLI:-claude}/${JUDGEMODEL:-opus}"
for pm in "${pairs[@]}"; do echo "   - $pm"; done
echo "================================================================"

for pm in "${pairs[@]}"; do
  prov="${pm%%:*}"; model="${pm#*:}"
  if [ "$prov" = "claude" ]; then tag="claude-$model"; else tag="$(printf '%s' "$model" | tr '/ :' '___')"; fi
  stamp="$(date +%Y%m%d-%H%M%S)"; out="$here/results/$tag/$stamp"; mkdir -p "$out"
  echo ""; echo "################  $pm  ################  -> results/$tag/$stamp"
  for sc in $SEEDED; do
    f="$out/$sc.$mode.txt"; printf "  %-3s %-6s seeded ... " "$sc" "$mode"
    if [ "$prov" = "claude" ]; then SEED_PROV=claude CMODEL="$model" "$here/run-seeded.sh" "$sc" "$mode" >"$f" 2>&1 && echo ok || echo FAILED
    else SEED_PROV=pi PIPROV="$prov" PIMODEL="$model" "$here/run-seeded.sh" "$sc" "$mode" >"$f" 2>&1 && echo ok || echo FAILED; fi
  done
  for sc in $INLINE; do
    f="$out/$sc.$mode.txt"; printf "  %-3s %-6s inline ... " "$sc" "$mode"
    if [ "$prov" = "claude" ]; then CMODEL="$model" "$here/run-claude.sh" "$sc" "$mode" >"$f" 2>&1 && echo ok || echo FAILED
    else PIPROV="$prov" PIMODEL="$model" "$here/run-pi.sh" "$sc" "$mode" >"$f" 2>&1 && echo ok || echo FAILED; fi
  done
  "$here/grade.sh" "$out" || true
done

echo ""; echo "################  COMPARISON  ################"
"$here/compare.sh"
