// Passive Verify-Before-Settle + Workspace Boundary Guard + Thrash Loop Breaker.
// Zero model-facing tools, zero Turn-1 token overhead, zero schema refusals.
// Captures args in tool_execution_start (Pi 1.6 omits args from tool_execution_end),
// blocks runaway whole-filesystem scans (`find /`, `rg ... /`), detects identical failing test
// thrash loops, and requests at most one verification pass if edits are unverified (skipping
// when pi-daddy-cold-review already requested a continuation on the same settle boundary).

const VERIFY_CMD_RE =
  /(?:^|[;&|]\s*)(?:(?:npx|pnpm|yarn|bun)\s+(?:test|vitest|jest|mocha|tsc|eslint|biome|check|run\s+(?:test|check|lint|typecheck|build))\b|npm\s+(?:test|run\s+(?:test|check|lint|typecheck|build))\b|node\s+(?:--test\b|-e\b|--eval\b|--input-type=\S+|[\w./-]+\.(?:c|m)?js\b)|python3?\s+(?:-m\s+(?:pytest|unittest)\b|-c\b|[\w./-]+\.py\b)|(?:bash|sh)\s+[\w./-]*test[\w./-]*|(?:vitest|jest|mocha|pytest|tsc|eslint|biome)\b|(?:cargo|go)\s+(?:test|check|vet)\b)/i;

const WHOLE_FS_SCAN_RE =
  /(?:^|[;&|]\s*)(?:find\s+\/(?:\s|$)|(?:grep|egrep|fgrep|rg)\s+(?:[^\n]*\s)?\/(?:\s|$))/;

function extractErrorSignature(result) {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  const text = blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /(?:AssertionError|Error:|FAIL|✖|not ok\b|TypeError|RangeError|SyntaxError)/i.test(l));
  return lines.slice(0, 3).join(" | ").slice(0, 220);
}

export default function verifyBeforeSettleExtension(pi) {
  let pendingArgs = new Map();
  let editedFiles = new Set();
  let lastEditTs = 0;
  let lastVerifyPassTs = 0;
  let lastVerifyFailCmd = null;
  let lastFailSig = "";
  let sameFailCount = 0;
  let consecutiveEditFails = 0;
  let nudgesUsed = 0;
  const MAX_NUDGES = 1;

  const resetTurn = () => {
    pendingArgs = new Map();
    editedFiles = new Set();
    lastEditTs = 0;
    lastVerifyPassTs = 0;
    lastVerifyFailCmd = null;
    lastFailSig = "";
    sameFailCount = 0;
    consecutiveEditFails = 0;
    nudgesUsed = 0;
  };

  pi.on("session_start", resetTurn);
  pi.on("before_agent_start", resetTurn);

  // Passive Workspace Boundary Guard: stop runaway `find /` or `rg /` whole-disk scans in <1ms.
  pi.on("tool_call", (event) => {
    if (event?.toolName !== "bash") return;
    const cmd = String(event?.input?.command ?? "");
    if (WHOLE_FS_SCAN_RE.test(cmd)) {
      return {
        block: true,
        reason:
          "Blocked whole-filesystem scan targeting '/'. Stay inside the current workspace directory (use '.' instead of '/').",
      };
    }
  });

  pi.on("tool_execution_start", (event) => {
    if (!event?.toolCallId) return;
    pendingArgs.set(event.toolCallId, event.args ?? {});
  });

  pi.on("tool_execution_end", (event) => {
    if (!event) return;
    const args = event.toolCallId ? pendingArgs.get(event.toolCallId) : undefined;
    if (event.toolCallId) pendingArgs.delete(event.toolCallId);

    const name = event.toolName;
    if (name === "edit" || name === "write") {
      if (!event.isError) {
        consecutiveEditFails = 0;
        const path = args?.path;
        if (typeof path === "string" && path.trim()) editedFiles.add(path.trim());
        else editedFiles.add("(modified file)");
        lastEditTs = Date.now();
      } else if (name === "edit") {
        consecutiveEditFails++;
      }
      return;
    }
    if (name === "bash") {
      const cmd = String(args?.command ?? "").trim();
      if (!VERIFY_CMD_RE.test(cmd)) return;
      if (!event.isError) {
        lastVerifyPassTs = Date.now();
        lastVerifyFailCmd = null;
        lastFailSig = "";
        sameFailCount = 0;
      } else {
        lastVerifyFailCmd = cmd.slice(0, 120);
        const sig = extractErrorSignature(event.result);
        if (sig && sig === lastFailSig) {
          sameFailCount++;
          if (sameFailCount >= 2) {
            try {
              pi.events?.emit("principal:thrash-detected:v1", {
                version: 1,
                signature: sig,
                count: sameFailCount,
                command: lastVerifyFailCmd,
                editedFiles: [...editedFiles],
              });
            } catch {
              /* Escalation listener is optional. */
            }
          }
        } else {
          lastFailSig = sig;
          sameFailCount = sig ? 1 : 0;
        }
      }
    }
  });

  // Deterministic Thrash & Edit-Loop Breaker: append concise recovery hint to repeated failures.
  pi.on("tool_result", (event) => {
    if (!event?.isError) return;
    if (event.toolName === "edit" && consecutiveEditFails >= 2) {
      return {
        content: [
          ...(Array.isArray(event.content) ? event.content : []),
          {
            type: "text",
            text: "\n[Harness edit-loop hint]: `edit` failed twice in a row. Read the exact file lines or use `write` to replace a small file cleanly instead of retrying the same edit.",
          },
        ],
      };
    }
    if (event.toolName === "bash" && sameFailCount >= 2) {
      return {
        content: [
          ...(Array.isArray(event.content) ? event.content : []),
          {
            type: "text",
            text: "\n[Harness loop detector]: The same verification error occurred twice in a row. Stop rewriting identical logic — check whether your test assertion itself has a bug, or call quick_review({ role: 'review' }) on both the implementation and test file.",
          },
        ],
      };
    }
  });

  pi.on("agent_before_settle", (event) => {
    // Avoid colliding with pi-daddy's cold diff review on the same settle boundary.
    if (Array.isArray(event?.entries) && event.entries.some((e) => e?.customType === "pi-daddy-cold-review")) {
      return;
    }
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
