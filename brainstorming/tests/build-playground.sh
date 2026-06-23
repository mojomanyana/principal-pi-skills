#!/usr/bin/env bash
#
# build-playground.sh — regenerate playground.html's data from results/.
# Reads each model's latest GRADES.tsv + transcripts and injects MODELS/RESULTS into the
# playground (between the /* DATA_START */ … /* DATA_END */ markers). Re-run after any bench.
#
# Env: JUDGE_LABEL (shown in the playground; default "opus (claude)").
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
results="$here/results"
html="$here/playground.html"
[ -d "$results" ] || { echo "no results/ yet — run ./bench.sh first" >&2; exit 1; }
[ -f "$html" ]   || { echo "missing playground.html" >&2; exit 1; }

python3 - "$results" "$html" "${JUDGE_LABEL:-opus (claude)}" <<'PY'
import sys, os, glob, json, datetime, re
results, html, judge = sys.argv[1], sys.argv[2], sys.argv[3]

def short(tag):
    i = tag.find("models_")
    return tag[i+7:] if i >= 0 else tag

def transcript(path):
    try:
        txt = open(path, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        return ""
    i = txt.find(">>> user")           # drop the run-script header noise
    return (txt[i:] if i >= 0 else txt).strip()

models, res = [], {}
for mdir in sorted(glob.glob(os.path.join(results, "*"))):
    if not os.path.isdir(mdir):
        continue
    runs = [r for r in sorted(glob.glob(os.path.join(mdir, "*")))
            if os.path.isfile(os.path.join(r, "GRADES.tsv"))]
    if not runs:
        continue
    latest = runs[-1]
    name = short(os.path.basename(mdir))
    models.append(name); res[name] = {}
    with open(os.path.join(latest, "GRADES.tsv"), encoding="utf-8") as f:
        next(f, None)
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 4 or p[1] != "green":
                continue
            sc, v, r = p[0], p[2], p[3]
            res[name][sc] = {"v": v, "r": r, "t": transcript(os.path.join(latest, f"{sc}.green.txt"))}
    d1 = os.path.join(latest, "D1.green.txt")          # run but not graded (harness)
    if os.path.exists(d1) and "D1" not in res[name]:
        res[name]["D1"] = {"v": None, "r": "(harness-enforced — not auto-graded; read the transcript)",
                           "t": transcript(d1)}

block = ("const MODELS = %s;\nconst RESULTS = %s;\nconst GENERATED = %s;\nconst JUDGE = %s;\n"
         % (json.dumps(models), json.dumps(res, ensure_ascii=False),
            json.dumps(datetime.date.today().isoformat()), json.dumps(judge)))

src = open(html, encoding="utf-8").read()
out = re.sub(r"/\* DATA_START \*/.*?/\* DATA_END \*/",
             lambda _: "/* DATA_START */\n" + block + "/* DATA_END */", src, flags=re.S)
open(html, "w", encoding="utf-8").write(out)
print(f"playground.html updated: {len(models)} models, "
      f"{sum(len(v) for v in res.values())} cells — open it in a browser.")
PY
