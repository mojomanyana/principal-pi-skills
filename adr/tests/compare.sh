#!/usr/bin/env bash
#
# compare.sh — cross-model comparison from graded runs. Prints a scenario x model matrix of
# GREEN (with-skill) verdicts + score/critical/verdict rows, and writes results/COMPARISON.md.
# Usage: ./compare.sh [results-root]   (default: ./results)
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="${1:-$here/results}"
[ -d "$root" ] || { echo "no results dir: $root (run bench.sh / grade.sh first)" >&2; exit 1; }

SCEN="A1 A2 A3 A4 A5 B1 C1 C2"
CRIT=" A1 A3 B1 C1 C2 "
short() { local m="$1"; printf '%s' "${m##*models_}"; }

models=(); declare -A G
for mdir in "$root"/*/; do
  [ -d "$mdir" ] || continue
  model="$(basename "$mdir")"
  latest="$(ls -1dt "$mdir"*/ 2>/dev/null | head -1)"
  [ -n "$latest" ] && [ -f "${latest}GRADES.tsv" ] || continue
  models+=("$model")
  while IFS=$'\t' read -r sc mode verdict reason; do
    [ "$mode" = "green" ] || continue
    [ "$sc" = "scenario" ] && continue
    G["$model|$sc"]="$verdict"
  done < "${latest}GRADES.tsv"
done
[ "${#models[@]}" -eq 0 ] && { echo "no graded runs under $root — run grade.sh (or bench.sh) first." >&2; exit 1; }

emit() {
  printf '%-7s' "scen"; for m in "${models[@]}"; do printf ' %-16s' "$(short "$m")"; done; printf '\n'
  printf '%-7s' "-------"; for m in "${models[@]}"; do printf ' %-16s' "----------------"; done; printf '\n'
  for sc in $SCEN; do
    mark=" "; case "$CRIT" in *" $sc "*) mark="*";; esac
    printf '%-5s%s ' "$sc" "$mark"
    for m in "${models[@]}"; do
      v="${G[$m|$sc]:-}"; case "$v" in PASS) c=PASS;; FAIL) c=FAIL;; "") c="·";; *) c="$v";; esac
      printf '%-16s ' "$c"
    done; printf '\n'
  done
  printf '%-7s' "-------"; for m in "${models[@]}"; do printf ' %-16s' "----------------"; done; printf '\n'
  printf '%-7s' "score"
  for m in "${models[@]}"; do p=0; t=0; for sc in $SCEN; do v="${G[$m|$sc]:-}"; [ -n "$v" ] && t=$((t+1)); [ "$v" = "PASS" ] && p=$((p+1)); done; printf ' %-16s' "$p/$t"; done; printf '\n'
  printf '%-7s' "crit-x"
  for m in "${models[@]}"; do cf=0; for sc in $SCEN; do case "$CRIT" in *" $sc "*) :;; *) continue;; esac; v="${G[$m|$sc]:-}"; [ -n "$v" ] && [ "$v" != "PASS" ] && cf=$((cf+1)); done; printf ' %-16s' "$cf"; done; printf '\n'
  printf '%-7s' "verdict"
  for m in "${models[@]}"; do
    p=0; t=0; cf=0
    for sc in $SCEN; do v="${G[$m|$sc]:-}"; [ -n "$v" ] && t=$((t+1)); [ "$v" = "PASS" ] && p=$((p+1)); case "$CRIT" in *" $sc "*) [ -n "$v" ] && [ "$v" != "PASS" ] && cf=$((cf+1));; esac; done
    vd="NOT READY"; { [ "$t" -ge 12 ] && [ "$p" -ge 10 ] && [ "$cf" -eq 0 ]; } && vd="SHIP"
    printf ' %-16s' "$vd"
  done; printf '\n'
  echo ""
  echo "* = critical scenario (any fail => NOT READY).  cells = GREEN/with-skill verdict.  · = not run."
}

{
  echo "# Cross-model comparison (brainstorming, GREEN/with-skill)"
  echo ""
  echo '```'
  emit
  echo '```'
  echo ""
  echo "Per-scenario reasons: each model's \`results/<model>/<timestamp>/REPORT.md\` and \`GRADES.tsv\`."
} > "$root/COMPARISON.md"

emit
echo ""
echo "→ written to ${root}/COMPARISON.md  (per-model detail in each REPORT.md)"
