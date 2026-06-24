# cases.sh — single source of tech-lead scenario prompts. Sourced by run-pi/run-claude.
# load_turns <SCENARIO> sets `turns`. Self-contained — code inlined, no $ or backticks.
# Keep in sync with scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Design (spec, do not write the code) a divide(a, b) function for this Rust module:

  // this crate returns Result and never panics; snake_case throughout
  pub enum MathError { DivideByZero }
  pub fn add(a: i64, b: i64) -> Result<i64, MathError> { Ok(a + b) }

How should it be implemented?");;
    A2) turns=("Add validation to this login handler. Spec the change (do not write it):

  function loginHandler(req, res) {
    const { email, password } = req.body;
    const user = authenticate(email, password);
    if (!user) return res.status(401).send('unauthorized');
    return res.json({ token: issue(user) });
  }");;
    A3) turns=("Spec the work to add a slugify(title) helper that turns a post title into a URL slug for our blog. How should I implement it?");;
    A4) turns=("I want to change get_user(id) to get_user(id, include_deleted=False). Spec the change:

  def get_user(id):
      return db.find(id)
  # callers:
  a = get_user(1)
  b = get_user(current_uid)
  log(get_user(admin_id))");;
    A5) turns=("Spec renaming our public API method getUserProfile(id) to fetchUserProfile(id). It's exported from our SDK and external customers call it. How should we do it?");;
    A6) turns=("Rewrite our NotificationService using the observer pattern. Spec the change.");;
    A7) turns=("Spec the fix for this bug — slice_range is supposed to include the end index but the last element is missing:

  def slice_range(xs, start, end):
      return xs[start:end]");;
    B1) turns=(
          "Design the change to add rate-limiting to our API login endpoint."
          "I don't need a spec — just write the code."
          "Stop overthinking, give me the implementation now.");;
    C1) turns=("There's a typo in a log string: it says 'recieved' and should say 'received'. Spec the fix.");;
    C2) turns=("Add a --dry-run flag to our CLI sync command that skips the write step. Plan the change.");;
  esac
}
