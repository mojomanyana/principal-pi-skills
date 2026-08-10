#!/usr/bin/env bash
# Live workflow E2E — the four cells the improvement plan calls for.
#
#   | Workflow | Subagents |            what it proves
#   |----------|-----------|-------------------------------------------------
#   | feature  | absent    | the spine runs inline and SAYS it ran inline
#   | bugfix   | absent    | same, through the debug->build->review path
#   | feature  | present   | it delegates instead, and the digest stops
#   | bugfix   | present   |   claiming inline
#
# Each cell packs the CURRENT tree, installs the tarball into a throwaway HOME, runs the
# workflow non-interactively, and asserts on the resulting git history. Nothing here touches
# the developer's real home or repo.
#
# ## The entry point, and why the obvious one is wrong
#
# `pi -p "/principal-feature <task>"` does NOT expand the slash command. Verified against a
# control: `/definitely-not-a-real-command say only OK` behaves identically — pi passes the
# text through, the model does the literal thing, no workflow runs, no commit is made, and
# nothing reports an error. Anyone scripting the workflow the obvious way gets a plausible
# answer with no workflow in it.
#
# `--prompt-template <path>` is the flag that registers a prompt template for a
# non-interactive run. With it, the spine executes and commits.
#
# ## Costs and requirements
#
# Each cell is a full workflow run (plan/debug -> build -> review -> git-ops) against a real
# model, so this spends real tokens. Needs `pi` on PATH and a provider configured in the
# developer's ~/.pi/agent — the credentials are COPIED into the throwaway home so the run
# does not touch the real one.
#
# Usage:  bash tests/e2e/run-e2e.sh [cell...]     (default: all four)
#         MODEL=... PROVIDER=... bash tests/e2e/run-e2e.sh feature-absent
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROVIDER="${PROVIDER:-fireworks}"
MODEL="${MODEL:-accounts/fireworks/models/deepseek-v4-pro}"
PI_PKG="$(dirname "$(readlink -f "$(command -v pi)")")/.."
EXT="$PI_PKG/examples/extensions/subagent"

pass=0; fail=0
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; pass=$((pass+1)); }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=$((fail+1)); }

# Pack once; every cell installs the same artifact.
PACKDIR=$(mktemp -d); trap 'rm -rf "$PACKDIR"' EXIT
TARBALL="$PACKDIR/$(cd "$ROOT" && npm pack --json --pack-destination "$PACKDIR" 2>/dev/null \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8'))[0].filename")"
[ -f "$TARBALL" ] || { echo "npm pack failed"; exit 1; }

# A throwaway HOME with the package installed. `with_subagents` additionally loads pi's own
# subagent extension (it ships inside the pi package, MIT) and installs the namespaced agents
# — so the "present" cells need no vendored copy of anyone else's code.
setup_home() {
  local with_subagents=$1 home proj
  home=$(mktemp -d); proj="$home/proj"; mkdir -p "$proj"
  cp ~/.pi/agent/auth.json ~/.pi/agent/models-store.json "$home/.pi/agent/" 2>/dev/null || true
  ( cd "$proj" && git init -q -b main \
      && git -c user.email=e2e@local -c user.name=e2e commit -q --allow-empty -m base )
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" pi install "npm:$TARBALL" >/dev/null 2>&1
  mkdir -p "$home/.pi/agent"
  cp ~/.pi/agent/auth.json ~/.pi/agent/models-store.json "$home/.pi/agent/" 2>/dev/null || true
  if [ "$with_subagents" = yes ]; then
    mkdir -p "$home/.pi/agent/extensions/subagent"
    cp "$EXT/index.ts" "$EXT/agents.ts" "$home/.pi/agent/extensions/subagent/" 2>/dev/null
    HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" \
      node "$home/.pi/agent/npm/node_modules/principal-pi-skills/scripts/install-agents.mjs" \
      install >/dev/null 2>&1
  fi
  echo "$home"
}

run_workflow() {  # home, prompt-name, task -> prints the transcript
  local home=$1 name=$2 task=$3
  local tree="$home/.pi/agent/npm/node_modules/principal-pi-skills"
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" timeout 900 \
    pi -p --provider "$PROVIDER" --model "$MODEL" \
       --prompt-template "$tree/prompts/$name.md" "/$name $task" 2>&1
}

cell_feature() {  # subagents: yes|no
  local subs=$1 home out
  say "feature x subagents ${subs}"
  home=$(setup_home "$subs")
  out=$(run_workflow "$home" principal-feature \
    "add a file named greet.txt containing the word hello")

  ( cd "$home/proj"
    if [ "$(git log --oneline | wc -l)" -gt 1 ]; then ok "the spine committed"; else bad "no commit — the workflow did not reach git-ops"; fi
    if [ -f greet.txt ]; then ok "the change landed in the caller's checkout"; else bad "greet.txt missing"; fi
    if [ -z "$(git status --porcelain)" ]; then ok "working tree clean (build's change was committed, not left loose)"; else bad "tree dirty after the spine finished"; fi )

  grep -qi "digest" <<<"$out" && ok "closed with a digest" || bad "no digest"
  if [ "$subs" = no ]; then
    grep -qiE "inline" <<<"$out" && ok "digest names the inline fallback" \
      || bad "ran inline but did not say so — the honesty requirement"
  else
    grep -qiE "no .*subagent available|inline phases: .*(plan|review)" <<<"$out" \
      && bad "claims inline while subagents ARE installed" \
      || ok "did not claim an inline fallback"
  fi
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-feature-$subs.txt"
  rm -rf "$home"
}

cell_bugfix() {  # subagents: yes|no
  local subs=$1 home out
  say "bugfix x subagents ${subs}"
  home=$(setup_home "$subs")
  # A real, reproducible bug: sum() ignores the last element.
  cat > "$home/proj/sum.js" <<'JS'
export function sum(xs) {
  let t = 0;
  for (let i = 0; i < xs.length - 1; i++) t += xs[i];
  return t;
}
JS
  ( cd "$home/proj" && git add -A \
      && git -c user.email=e2e@local -c user.name=e2e commit -q -m "add sum" )
  out=$(run_workflow "$home" principal-bugfix \
    "sum([1,2,3]) returns 3 instead of 6 in sum.js — the last element is dropped")

  ( cd "$home/proj"
    if [ "$(git log --oneline | wc -l)" -gt 2 ]; then ok "the spine committed a fix"; else bad "no fix commit"; fi
    if grep -q "i < xs.length;" sum.js 2>/dev/null || ! grep -q "xs.length - 1" sum.js; then
      ok "the off-by-one is actually fixed"; else bad "sum.js still drops the last element"; fi
    if [ -z "$(git status --porcelain)" ]; then ok "working tree clean"; else bad "tree dirty"; fi )

  grep -qi "digest" <<<"$out" && ok "closed with a digest" || bad "no digest"
  grep -qiE "root cause" <<<"$out" && ok "digest carries the root cause" || bad "no root cause in the digest"
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-bugfix-$subs.txt"
  rm -rf "$home"
}

CELLS=("${@:-feature-absent bugfix-absent feature-present bugfix-present}")
for c in ${CELLS[@]}; do
  case "$c" in
    feature-absent)  cell_feature no  ;;
    feature-present) cell_feature yes ;;
    bugfix-absent)   cell_bugfix  no  ;;
    bugfix-present)  cell_bugfix  yes ;;
    *) echo "unknown cell: $c" ;;
  esac
done

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
