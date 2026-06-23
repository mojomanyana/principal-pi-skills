#!/usr/bin/env bash
# Coder A1 re-validation: re-run the seeded A1 with the fixes in place (git diff --cached stages
# new files; A1 graded on the observable outcome = a covering test that passes). Confirms A1
# grades fairly — a written test is visible in the diff, not merely inferred from pytest.
# Usage:  env -u ANTHROPIC_API_KEY ./a1-revalidate.sh
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JUDGE="${JUDGEMODEL:-opus}"
mapfile -t pairs < <(grep -vE '^[[:space:]]*(#|$)' models.txt)
echo "### Coder A1 re-validation   judge: $JUDGE ###"
for pm in "${pairs[@]}"; do
  prov="${pm%%:*}"; model="${pm#*:}"
  if [ "$prov" = "claude" ]; then tag="claude-$model"; else tag="$(printf '%s' "$model" | tr '/ :' '___')"; fi
  out="results/$tag/a1-reval"; rm -rf "$out"; mkdir -p "$out"; f="$out/A1.green.txt"
  if [ "$prov" = "claude" ]; then SEED_PROV=claude CMODEL="$model" ./run-seeded.sh A1 green >"$f" 2>&1
  else SEED_PROV=pi PIPROV="$prov" PIMODEL="$model" ./run-seeded.sh A1 green >"$f" 2>&1; fi
  JUDGEMODEL="$JUDGE" ./grade.sh "$out" >/dev/null 2>&1 || true
  v="$(awk -F'\t' '$1=="A1"{print $3}' "$out/GRADES.tsv" 2>/dev/null)"
  tindiff=$(grep -qE 'b/test_.*\.py|def test_|new file mode .* test_' "$f" && echo yes || echo no)
  pyt=$(grep -qE '[0-9]+ passed' "$f" && echo green || echo "none")
  printf "  %-26s A1=%-5s  test-in-diff=%-3s  pytest=%s\n" "$tag" "${v:-?}" "$tindiff" "$pyt"
done
