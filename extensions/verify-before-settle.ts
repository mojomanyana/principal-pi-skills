// Passive Verify-Before-Settle guard.
// Zero model-facing tools, zero Turn-1 token overhead, zero schema refusals.
// Tracks edited workspace files and passing verification commands passively;
// if code was modified after the last passing check, requests at most one verification pass.

const VERIFY_CMD_RE = /\b(test|vitest|jest|mocha|pytest|cargo\s+test|go\s+test|tsc|eslint|lint|check|verify|assert|node\s+[\w./-]+\.(?:c|m)?js|node\s+--test|npm\s+run\s+(?:test|check|build|typecheck|lint))\b/i;

export default function verifyBeforeSettleExtension(pi) {
  let editedFiles = new Set();
  let lastEditTs = 0;
  let lastVerifyPassTs = 0;
  let lastVerifyFailCmd = null;
  let nudgesUsed = 0;
  const MAX_NUDGES = 1;

  const resetTurn = () => {
    editedFiles = new Set();
    lastEditTs = 0;
    lastVerifyPassTs = 0;
    lastVerifyFailCmd = null;
    nudgesUsed = 0;
  };

  pi.on("session_start", resetTurn);
  pi.on("before_agent_start", resetTurn);

  pi.on("tool_execution_end", (event) => {
    if (!event) return;
    const name = event.toolName;
    if ((name === "edit" || name === "write") && !event.isError) {
      const path = event.args?.path ?? event.input?.path;
      if (typeof path === "string" && path.trim()) editedFiles.add(path.trim());
      else editedFiles.add("(modified file)");
      lastEditTs = Date.now();
      return;
    }
    if (name === "bash") {
      const cmd = String(event.args?.command ?? event.input?.command ?? "");
      if (!VERIFY_CMD_RE.test(cmd)) return;
      if (!event.isError) {
        lastVerifyPassTs = Date.now();
        lastVerifyFailCmd = null;
      } else {
        lastVerifyFailCmd = cmd.slice(0, 120);
      }
    }
  });

  pi.on("agent_before_settle", (event) => {
    if (nudgesUsed >= MAX_NUDGES) return;
    if (editedFiles.size === 0 || lastEditTs === 0) return;
    if (lastVerifyPassTs >= lastEditTs && !lastVerifyFailCmd) return;

    nudgesUsed++;
    const fileList = [...editedFiles].slice(0, 6).join(", ");
    const reason = lastVerifyFailCmd
      ? `Your last verification command failed (${lastVerifyFailCmd}). Fix the issue and re-verify before finishing.`
      : `You edited ${fileList} after your last passing check. Run the relevant tests or executable verification (including edge cases) and confirm they pass before concluding.`;

    return {
      entries: [
        ...(Array.isArray(event?.entries) ? event.entries : []),
        {
          type: "custom_message",
          customType: "principal-verify-before-settle",
          content: reason,
          display: false,
        },
      ],
      continue: true,
    };
  });
}
