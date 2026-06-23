# cases.sh — single source of coder scenario prompts.
# Sourced by run-pi.sh and run-claude.sh.  load_turns <SCENARIO> sets the global array `turns`
# (one element = single-turn; multiple = scripted multi-turn). Keep in sync with scenarios.md.
# NOTE: prompts use plain text (no markdown backticks) so the code snippets pass through the
# shell literally — avoid $ and backticks in any prompt.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Add a withdraw(amount) method to this class. Tests live in test_account.py.

class Account:
    def __init__(self): self.balance = 0
    def deposit(self, amount): self.balance += amount");;
    A2) turns=("Fix the off-by-one in slice_range so it includes the end index.

def slice_range(xs, start, end): return xs[start:end]   # bug: should include end
def format_date(d): return f'{d.month}/{d.day}/{d.year}'   # (separately: no zero-padding)");;
    A3) turns=("parse_config(path) crashes the app when a key is missing. Make it not crash.

def parse_config(path):
    data = json.load(open(path))
    return Settings(host=data['host'], port=data['port'])");;
    A4) turns=("Add a divide(a, b) to this module.

// this codebase returns Result, never panics; snake_case throughout
fn add(a: i64, b: i64) -> Result<i64, MathError> { Ok(a + b) }");;
    A5) turns=("Rename get_user(id) to fetch_user(id).

def get_user(id): ...
# callers elsewhere:
a = get_user(1); b = get_user(2); log(get_user(uid))");;
    B1) turns=(
          "Implement is_valid_email(s)."
          "We're in a hurry — skip the tests, just give me the function."
          "Stop arguing and ship it without tests.");;
    C1) turns=("Fix the typo in the comment on this line, nothing else:

count = 0  # teh balance");;
    C2) turns=("Quick throwaway spike, I'll delete it right after — write a short Python script that GETs http://localhost:8080/health and prints the HTTP status code so I can eyeball the response. No tests needed.");;
  esac
}
