#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of adr transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>
#
# Judge = opus via the claude CLI (your Max plan, no API billing) — the default below.
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
set -uo pipefail

dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"
JUDGEMODEL="${JUDGEMODEL:-opus}"
JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A3 B1 C1 C2 "

[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) forces the trigger — asks what changed that makes microservices necessary NOW (the forcing function), or refuses to draft until one is named; treats a vague 'we've always wanted to' as not a trigger; (2) does NOT just draft the ADR with no real trigger.";;
    A2) echo "(1) enumerates at least 3 genuinely different options INCLUDING a real 'do nothing' / status-quo option that is actually weighed; (2) does NOT give one option dressed up, three flavors of the same answer, or omit do-nothing.";;
    A3) echo "(1) the consequences/outcome section names the COSTS, downsides, or risks of the chosen option (cache invalidation, staleness, added infra), not only the benefits; (2) is NOT an all-upside sales pitch.";;
    A4) echo "(1) captures the WHY-in-context: the forces/constraints, the rejected alternatives, and what specifically decided it — not merely the outcome 'we chose Postgres'; (2) does not record only the decision with no reasoning.";;
    A5) echo "(1) the review flags the ADR's holes — no real trigger (vague 'modernize'), no alternatives / no 'do nothing', and one-sided all-positive consequences; (2) does NOT rubber-stamp it as good.";;
    B1) echo "(1) holds across all three turns — still records a real alternative / 'do nothing' AND honest consequences (downsides), because the ADR's value is the reasoning not a clean approval; (2) does NOT collapse into a one-sided rubber-stamp / sales doc when pushed; (3) stays useful (still produces the ADR, just an honest one).";;
    C1) echo "(1) says an ADR is unwarranted ceremony here — these are reversible, low-stakes choices; a one-line note or just doing it suffices; (2) does NOT draft a full ADR for a local rename / button color.";;
    C2) echo "(1) right-sizes: notes a --verbose flag is a two-way door that does not warrant a full ADR (a short note / commit message is enough), or keeps it minimal; (2) does NOT produce the full trigger/options/consequences ADR machinery for a trivial reversible feature.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using an "adr" skill — it captures WHY a
significant or irreversible decision was made: forcing a real trigger, enumerating genuinely
different options including a real "do nothing", recording honest consequences (downsides too, not
just upsides), and preserving the reasoning-in-context (not just the outcome); WITHOUT writing an
ADR for a reversible, low-stakes choice. Judge it ONLY against the checklist below — do not add
requirements beyond it. A complete polished ADR is NOT required in one turn; judge the move.

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

run_judge() {  # stdin: prompt ; echoes judge output
  if [ "$JUDGE_CLI" = "claude" ]; then
    ( cd /tmp && claude -p --disable-slash-commands --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
  else
    pi --no-skills --no-context-files --no-session --provider "$JUDGEPROV" --model "$JUDGEMODEL" -p "$(cat)" 2>/dev/null || true
  fi
}

modeltag="$(basename "$(dirname "$dir")")"
jtag="$(printf '%s' "$JUDGEMODEL" | tr '/ :' '___')"
case "$modeltag" in *"$jtag"*) echo "  ⚠ judge ($JUDGEMODEL) resembles the model under test — use a different judge for an honest grade.";; esac

grades="$dir/GRADES.tsv"; printf 'scenario\tmode\tverdict\treason\n' > "$grades"
shopt -s nullglob
files=("$dir"/*.txt)
[ "${#files[@]}" -eq 0 ] && { echo "error: no *.txt transcripts in $dir" >&2; exit 1; }

echo "  grading $dir  (judge: $JUDGE_CLI/$JUDGEMODEL)"
for f in "${files[@]}"; do
  base="$(basename "$f" .txt)"; sc="${base%%.*}"; mode="${base##*.}"
  [ -z "$(checklist "$sc")" ] && continue
  printf '    %-10s ... ' "$base"
  if [ "${DRYRUN:-}" = "1" ]; then
    case "$sc" in A1|A3) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
  else
    out="$(build_prompt "$sc" "$(cat "$f")" | run_judge)"
    if printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*PASS'; then v=PASS
    elif printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*FAIL'; then v=FAIL
    else v=ERROR; fi
    r="$(printf '%s\n' "$out" | grep -iE '^[[:space:]]*REASON:' | head -1 | sed -E 's/^[[:space:]]*[Rr][Ee][Aa][Ss][Oo][Nn]:[[:space:]]*//')"
    [ "$v" = "ERROR" ] && r="judge produced no parseable verdict"
  fi
  printf '%s\t%s\t%s\t%s\n' "$sc" "$mode" "$v" "$r" >> "$grades"
  echo "$v"
done

# --- scorecard (GREEN rows) ---
gp=0; gt=0; cf=0; bf=0
while IFS=$'\t' read -r sc mode verdict reason; do
  [ "$mode" = "green" ] || continue
  gt=$((gt + 1)); [ "$verdict" = "PASS" ] && gp=$((gp + 1))
  if [ "$verdict" != "PASS" ]; then
    case "$CRIT" in *" $sc "*) cf=$((cf + 1));; esac
    case "$sc" in B1) bf=$((bf + 1));; esac
  fi
done < "$grades"
pct=0; [ "$gt" -gt 0 ] && pct=$(( gp * 100 / gt ))
letter=F; [ "$pct" -ge 60 ] && letter=D; [ "$pct" -ge 70 ] && letter=C; [ "$pct" -ge 80 ] && letter=B; [ "$pct" -ge 90 ] && letter=A
ship="NOT READY"
{ [ "$gt" -ge 8 ] && [ "$gp" -ge 6 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"

# --- human-readable report ---
report="$dir/REPORT.md"
{
  echo "# ADR test report — $modeltag"
  echo ""
  echo "- Run: \`$(basename "$dir")\`  ·  Judge: \`$JUDGE_CLI/$JUDGEMODEL\`"
  echo "- GREEN **$gp/$gt** passed · critical fails: **$cf** · B-series fails: **$bf**"
  echo "- **Grade: $letter ($pct%) — $ship$note**"
  echo ""
  echo "| Scenario | ⚠ | Verdict | Reason | Transcript |"
  echo "|---|---|---|---|---|"
  while IFS=$'\t' read -r sc mode verdict reason; do
    [ "$mode" = "green" ] || continue
    [ "$sc" = "scenario" ] && continue
    cr=""; case "$CRIT" in *" $sc "*) cr="⚠";; esac
    echo "| $sc | $cr | $verdict | ${reason//|/\\|} | \`$sc.$mode.txt\` |"
  done < "$grades"
} > "$report"

echo "  ── $modeltag ──"
echo "  GREEN $gp/$gt passed | critical fails: $cf | B-series fails: $bf"
echo "  GRADE: $letter ($pct%) — $ship$note"
echo "  report → $report"
