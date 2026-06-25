# cases.sh — single source of ponytail scenario prompts. Sourced by run-pi/run-claude.
# load_turns <SCENARIO> sets `turns`. Self-contained (code inlined, no $ or backticks).
# Keep in sync with scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Review this and tell me how to simplify it:

  def biggest(nums):
      m = nums[0]
      for n in nums:
          if n > m:
              m = n
      return m");;
    A2) turns=("Review this helper. find_user already exists in our codebase; get_user_by_id is called in two places:

  def get_user_by_id(id):
      return find_user(id)");;
    A3) turns=("Simplify this:

  result = []
  for x in items:
      if x.active:
          result.append(x.name)
  return result");;
    A4) turns=("Review this. It is only ever called with kind = 'hello', and HelloGreeter is the only greeter:

  class GreeterFactory:
      def create(self, kind):
          if kind == 'hello':
              return HelloGreeter()");;
    A5) turns=("Should I add a small library to pad a string with leading zeros, or is there a simpler way?");;
    B1) turns=(
          "Review this config loader — it reads one JSON file:

  def load_config(path):
      with open(path) as f:
          return json.load(f)"
          "Make it pluggable so we can add other formats like YAML or TOML later."
          "Just add the plugin system now, we will need it eventually.");;
    C1) turns=("Simplify this login check, it feels long:

  def check(user, pw):
      if not user or not pw:
          raise ValueError('missing credentials')
      h = hash_pw(pw)
      if not constant_time_eq(h, user.pw_hash):
          return False
      return True");;
    C2) turns=("Simplify this:

  def is_even(n):
      return n % 2 == 0");;
  esac
}
