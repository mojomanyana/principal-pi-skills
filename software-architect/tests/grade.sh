#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of software-architect transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>
#
# Judge = opus via the claude CLI (your Max plan, no API billing) — the default below.
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
# Writes GRADES.tsv + REPORT.md into the dir, prints a scorecard. Checklists mirror scenarios.md.
#
set -uo pipefail

dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"
JUDGEMODEL="${JUDGEMODEL:-opus}"
JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A2 A5 B1 C1 C2 "

[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) reframes to the measurable quality attribute (what is actually slow, what latency/throughput target) before endorsing a cache; (2) does NOT recommend a cache/Redis blind, with no driver named.";;
    A2) echo "(1) defaults to the simpler option (a modular monolith) for a 3-engineer team; (2) invokes team size / Conway's law (services need team boundaries; microservices with one tiny team = distributed monolith); (3) does NOT endorse microservices as the answer — at most names a future threshold to revisit.";;
    A3) echo "(1) flags the Postgres->DynamoDB switch as a one-way / hard-to-reverse door (access-pattern lock-in, migration cost) BEFORE any reassurance; (2) treats it with weight proportionate to irreversibility, not casually.";;
    A4) echo "(1) asks what specific failure / quality attribute event sourcing + CQRS is meant to address before endorsing; (2) does NOT rubber-stamp it or jump straight to how-to-implement.";;
    A5) echo "(1) counters the from-scratch rewrite with an incremental path (strangler fig / branch-by-abstraction / parallel run) and names the empirical risk of big-bang rewrites; (2) does NOT help plan a from-scratch rewrite or agree it is the right move.";;
    A6) echo "(1) pushes back on designing for 10M users (1000x) at zero users; (2) recommends designing for ~10x current with the larger scale point made a deliberate later decision; (3) does NOT just design the 10M-user architecture as asked.";;
    A7) echo "(1) centers the answer on THIS workload, not abstract features — does NOT give a flat feature-based pick (e.g. 'use Mongo, it scales'); (2) either demands the workload shape first, OR gives a conditional rule tied to it (X unless workload-condition Y) and asks for the workload to confirm. A decisive 'default to X unless [these specific workload conditions]' that still requests the workload is a PASS.";;
    B1) echo "(1) by the final turn gives a CONDITIONAL decision rule tied to the unknown (volume / replay need / event-platform ambition) rather than a basis-free pick; (2) names the simpler option (a Postgres or RabbitMQ queue) even while being decisive; (3) does NOT cave to a basis-free 'yes, Kafka', and does NOT just loop the same question.";;
    C1) echo "(1) endorses the simple single-table option quickly — it is low-stakes and reversible; (2) at most ONE light clarifying question; does NOT launch a full quality-attribute interview, ADR, or C4 ceremony on a trivial reversible choice.";;
    C2) echo "(1) engages the actual reasoning of the plan; (2) if it finds no load-bearing flaw, says so honestly (adds at most a genuine specific risk, e.g. replica lag for fresh reads); (3) does NOT manufacture complexity objections or force an ADR / C4 / heavy process onto a sound, reversible, well-argued plan.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using a "software-architect" skill — it weighs
technical choices by demanding a measurable quality attribute before a mechanism, defaulting to
the simplest thing that works (complexity must earn its place + Conway's law), naming reversibility
(one-way vs two-way doors), resisting buzzwords / premature scale / big rewrites, and reframing
tech-selection to the actual workload; WITHOUT over-processing a cheap, reversible question. Judge
it ONLY against the checklist below — do not add requirements beyond it. The skill defers full C4
diagrams and ADRs to a real design pass, so their absence in a single advisory turn is NOT a
failure unless the checklist explicitly asks for them.

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
    ( cd /tmp && claude -p --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
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
    case "$sc" in A2|A5) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
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
{ [ "$gt" -ge 10 ] && [ "$gp" -ge 8 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"

# --- human-readable report ---
report="$dir/REPORT.md"
{
  echo "# Software-Architect test report — $modeltag"
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
