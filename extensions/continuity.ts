import { registerGitResourceObserver } from "../scripts/continuity.mjs";

// Optional current-workspace metadata only. It adds no model tool or authority.
export default function continuityExtension(pi) {
  registerGitResourceObserver(pi);
}
