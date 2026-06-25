#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of ponytail transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>   ·   Judge = opus via claude CLI (Max, no API billing).
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
set -uo pipefail
dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"; JUDGEMODEL="${JUDGEMODEL:-opus}"; JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A2 B1 C1 C2 "
[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) points to the language builtin (max) as the replacement; (2) says to delete the hand-rolled loop — does NOT merely tweak/keep the loop.";;
    A2) echo "(1) recognizes the wrapper adds nothing over the existing find_user; (2) recommends calling find_user directly and deleting the wrapper — does NOT keep it or 'improve' it.";;
    A3) echo "(1) offers the list comprehension / one concise expression ([x.name for x in items if x.active]); (2) does NOT just say 'looks fine' or only cosmetically tweak.";;
    A4) echo "(1) calls the factory premature for a single implementation; (2) recommends inlining (use HelloGreeter directly), abstract on the 3rd use — does NOT keep or expand the abstraction.";;
    A5) echo "(1) uses the built-in (zfill / rjust / padStart); (2) explicitly does NOT recommend adding a dependency for a one-liner.";;
    B1) echo "(1) HOLDS across the turns — declines to build the speculative plugin system now and names the cost of speculative flexibility (YAGNI), offering to add it when the need is real; (2) stays useful and not dogmatic — still delivers/endorses the simple loader, does not just refuse.";;
    C1) echo "(1) KEEPS the empty-credentials validation AND the constant-time security compare while simplifying; (2) does NOT strip the guard or weaken security (e.g. swapping constant_time_eq for ==) to make it shorter. The governor: never trade a safeguard for fewer lines.";;
    C2) echo "(1) says the code is already minimal / nothing to cut; (2) does NOT manufacture a change or golf it into a less-readable 'clever' form to look useful.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using a "ponytail" skill — a simplicity sidekick
that cuts bloat, reuses what exists (builtins/stdlib/existing code over new code), questions whether
code needs to exist, and avoids premature abstraction — WITHOUT ever stripping a safeguard
(validation, error handling, security, tests) and WITHOUT manufacturing changes on already-minimal
code. Judge it ONLY against the checklist below — do not add requirements beyond it.

CHECKLIST (every numbered item must hold for a PASS):
$(checklist "$1")

TRANSCRIPT (the assistant is the model under test):
$2

Grade each checklist item PASS or FAIL with a <=12-word justification quoting the transcript.
Be skeptical: if an item is not clearly satisfied, mark it FAIL. Then output these two lines:
VERDICT: PASS      (only if EVERY item passed)   — or —   VERDICT: FAIL
REASON: <15 words or fewer>
JUDGE_EOF
}

run_judge() {
  if [ "$JUDGE_CLI" = "claude" ]; then
    ( cd /tmp && claude -p --disable-slash-commands --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
  else
    pi --no-skills --no-context-files --no-session --provider "$JUDGEPROV" --model "$JUDGEMODEL" -p "$(cat)" 2>/dev/null || true
  fi
}

modeltag="$(basename "$(dirname "$dir")")"
jtag="$(printf '%s' "$JUDGEMODEL" | tr '/ :' '___')"
case "$modeltag" in *"$jtag"*) echo "  ⚠ judge ($JUDGEMODEL) resembles the model under test — use a different judge.";; esac

grades="$dir/GRADES.tsv"; printf 'scenario\tmode\tverdict\treason\n' > "$grades"
shopt -s nullglob
files=("$dir"/*.txt)
[ "${#files[@]}" -eq 0 ] && { echo "error: no *.txt transcripts in $dir" >&2; exit 1; }
echo "  grading $dir  (judge: $JUDGE_CLI/$JUDGEMODEL)"
for f in "${files[@]}"; do
  base="$(basename "$f" .txt)"; sc="${base%%.*}"; mode="${base##*.}"
  [ -z "$(checklist "$sc")" ] && continue
  printf '    %-10s ... ' "$base"
  if [ "${DRYRUN:-}" = "1" ]; then case "$sc" in C1|A2) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
  else
    out="$(build_prompt "$sc" "$(cat "$f")" | run_judge)"
    if printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*PASS'; then v=PASS
    elif printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*FAIL'; then v=FAIL
    else v=ERROR; fi
    r="$(printf '%s\n' "$out" | grep -iE '^[[:space:]]*REASON:' | head -1 | sed -E 's/^[[:space:]]*[Rr][Ee][Aa][Ss][Oo][Nn]:[[:space:]]*//')"
    [ "$v" = "ERROR" ] && r="judge produced no parseable verdict"
  fi
  printf '%s\t%s\t%s\t%s\n' "$sc" "$mode" "$v" "$r" >> "$grades"; echo "$v"
done

gp=0; gt=0; cf=0; bf=0
while IFS=$'\t' read -r sc mode verdict reason; do
  [ "$mode" = "green" ] || continue
  gt=$((gt+1)); [ "$verdict" = "PASS" ] && gp=$((gp+1))
  if [ "$verdict" != "PASS" ]; then case "$CRIT" in *" $sc "*) cf=$((cf+1));; esac; case "$sc" in B1) bf=$((bf+1));; esac; fi
done < "$grades"
pct=0; [ "$gt" -gt 0 ] && pct=$(( gp*100/gt ))
letter=F; [ "$pct" -ge 60 ] && letter=D; [ "$pct" -ge 70 ] && letter=C; [ "$pct" -ge 80 ] && letter=B; [ "$pct" -ge 90 ] && letter=A
ship="NOT READY"; { [ "$gt" -ge 8 ] && [ "$gp" -ge 6 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"
report="$dir/REPORT.md"
{
  echo "# Ponytail test report — $modeltag"; echo ""
  echo "- Run: \`$(basename "$dir")\`  ·  Judge: \`$JUDGE_CLI/$JUDGEMODEL\`"
  echo "- GREEN **$gp/$gt** passed · critical fails: **$cf** · B-series fails: **$bf**"
  echo "- **Grade: $letter ($pct%) — $ship$note**"; echo ""
  echo "| Scenario | ⚠ | Verdict | Reason | Transcript |"; echo "|---|---|---|---|---|"
  while IFS=$'\t' read -r sc mode verdict reason; do
    [ "$mode" = "green" ] || continue; [ "$sc" = "scenario" ] && continue
    cr=""; case "$CRIT" in *" $sc "*) cr="⚠";; esac
    echo "| $sc | $cr | $verdict | ${reason//|/\\|} | \`$sc.$mode.txt\` |"
  done < "$grades"
} > "$report"
echo "  ── $modeltag ──"; echo "  GREEN $gp/$gt passed | critical fails: $cf | B-series fails: $bf"
echo "  GRADE: $letter ($pct%) — $ship$note"; echo "  report → $report"
