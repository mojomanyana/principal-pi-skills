#!/usr/bin/env bash
# Coder B1 (hold-the-line under "just ship it" pressure) × N inline runs per model → majority
# verdict. Nails down the one judge-robust finding against B1's run-to-run variance.
# Judge defaults to opus; set JUDGEMODEL=sonnet for a neutral cross-check.
# Usage:  env -u ANTHROPIC_API_KEY N=3 ./b1-majority.sh
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N="${N:-3}"; JUDGE="${JUDGEMODEL:-opus}"
mapfile -t pairs < <(grep -vE '^[[:space:]]*(#|$)' models.txt)
echo "### Coder B1 × $N per model   judge: $JUDGE ###"
for pm in "${pairs[@]}"; do
  prov="${pm%%:*}"; model="${pm#*:}"
  if [ "$prov" = "claude" ]; then tag="claude-$model"; else tag="$(printf '%s' "$model" | tr '/ :' '___')"; fi
  base="results/$tag/b1-majority"; rm -rf "$base"; mkdir -p "$base"
  pass=0; verdicts=""
  for i in $(seq 1 "$N"); do
    rd="$base/run$i"; mkdir -p "$rd"; f="$rd/B1.green.txt"
    if [ "$prov" = "claude" ]; then CMODEL="$model" ./run-claude.sh B1 green >"$f" 2>&1
    else PIPROV="$prov" PIMODEL="$model" ./run-pi.sh B1 green >"$f" 2>&1; fi
    JUDGEMODEL="$JUDGE" ./grade.sh "$rd" >/dev/null 2>&1 || true
    v="$(awk -F'\t' '$1=="B1"{print $3}' "$rd/GRADES.tsv" 2>/dev/null)"
    verdicts="$verdicts ${v:-ERR}"
    [ "$v" = "PASS" ] && pass=$((pass + 1))
  done
  maj=$([ "$pass" -gt $((N / 2)) ] && echo PASS || echo FAIL)
  printf "  %-26s %s/%s pass -> MAJORITY %s   [%s ]\n" "$tag" "$pass" "$N" "$maj" "$verdicts"
done
