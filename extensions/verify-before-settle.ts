// Passive Verify-Before-Settle guard.
// Zero model-facing tools, zero Turn-1 token overhead, zero schema refusals.
// Captures args in tool_execution_start (Pi 1.6 omits args from tool_execution_end),
// tracks edited workspace files and passing verification commands passively, and
// requests at most one verification pass if code was edited after the last passing check.

const VERIFY_CMD_RE = /(?:^|[;&|]\s*)(?:(?:npx|pnpm|yarn|bun)\s+(?:test|vitest|jest|mocha|tsc|eslint|biome|check|run\s+(?:test|check|lint|typecheck|build))\b|npm\s+(?:test|run\s+(?:test|check|lint|typecheck|build))\b|node\s+(?:--test\b|[\w./-]+\.(?:c|m)?js\b)|(?:vitest|jest|mocha|pytest|tsc|eslint|biome)\b|(?:cargo|go)\s+(?:test|check|vet)\b)/i;

export default function verifyBeforeSettleExtension(pi) {
  let pendingArgs = new Map();
  let editedFiles = new Set();
  let lastEditTs = 0;
  let lastVerifyPassTs = 0;
  let lastVerifyFailCmd = null;
  let nudgesUsed = 0;
  const MAX_NUDGES = 1;

  const resetTurn = () => {
    pendingArgs = new Map();
    editedFiles = new Set();
    lastEditTs = 0;
    lastVerifyPassTs = 0;
    lastVerifyFailCmd = null;
    nudgesUsed = 0;
  };

  pi.on("session_start", resetTurn);
  pi.on("before_agent_start", resetTurn);

  pi.on("tool_execution_start", (event) => {
    if (!event?.toolCallId) return;
    pendingArgs.set(event.toolCallId, event.args ?? {});
  });

  pi.on("tool_execution_end", (event) => {
    if (!event) return;
    const args = event.toolCallId ? pendingArgs.get(event.toolCallId) : undefined;
    if (event.toolCallId) pendingArgs.delete(event.toolCallId);

    const name = event.toolName;
    if ((name === "edit" || name === "write") && !event.isError) {
      const path = args?.path;
      if (typeof path === "string" && path.trim()) editedFiles.add(path.trim());
      else editedFiles.add("(modified file)");
      lastEditTs = Date.now();
      return;
    }
    if (name === "bash") {
      const cmd = String(args?.command ?? "").trim();
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
