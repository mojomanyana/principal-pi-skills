// The operator confirms setup in the current Pi session; model-supplied booleans are not consent.
import { realpathSync } from "node:fs";
import { inspectProject, initializeProject, ProjectSetupError } from "../scripts/project-setup.mjs";

export function createProjectSetup(pi) {
  let generation = 0, pending = false;
  for (const event of ["session_start", "session_switch", "session_fork", "session_tree", "model_select", "session_shutdown"])
    pi.on(event, () => { generation++; });
  const request = async (ctx, path = undefined, signal = undefined) => {
    if (signal?.aborted) throw new ProjectSetupError("SETUP_CANCELLED", "Project setup was cancelled; nothing changed.");
    const cwd = realpathSync(ctx.cwd);
    if (path !== undefined && realpathSync(path) !== cwd)
      throw new ProjectSetupError("SETUP_WRONG_FOLDER", "Project setup only applies to this Pi session's current folder.");
    const before = inspectProject(cwd);
    if (before.state !== "setup-required") return before;
    const checkTrust = () => {
      if (typeof ctx.isProjectTrusted !== "function" || ctx.isProjectTrusted() !== true)
        throw new ProjectSetupError("SETUP_TRUST_REQUIRED", "Project setup needs Pi to trust this folder first. Planning and memory recall can continue without Git setup.");
    };
    checkTrust();
    if (pending) throw new ProjectSetupError("SETUP_ALREADY_PENDING", "A project setup question is already open in Pi.");
    if (!ctx.hasUI || typeof ctx.ui?.confirm !== "function")
      throw new ProjectSetupError("SETUP_CONFIRMATION_REQUIRED", "This folder needs one empty Git baseline. Open it in interactive Pi to confirm setup; planning and memory recall can continue without it.");
    const session = ctx.sessionManager.getSessionId(), epoch = generation;
    const check = () => {
      if (signal?.aborted || epoch !== generation || ctx.sessionManager.getSessionId() !== session || realpathSync(ctx.cwd) !== cwd)
        throw new ProjectSetupError("SETUP_CONTEXT_CHANGED", "The Pi session or folder changed while setup was open. Nothing was initialized.");
    };
    pending = true;
    try {
      const accepted = await ctx.ui.confirm("Prepare this folder for coding?",
        `${cwd}\n\nCreate one empty Git setup commit so Pi can track changes and pass them to reviewers. Your files stay uncommitted. Runtime notes are excluded locally. No remote, publication or global Git settings will be added.\n\nChoose No to leave the folder unchanged.`);
      check();
      if (!accepted) return { version: 1, state: "cancelled", approval: false, administrativeWrites: false, message: "Setup cancelled; the folder is unchanged." };
      checkTrust();
      return initializeProject(cwd, before.observationToken);
    } finally { pending = false; }
  };
  pi.registerCommand("principal-setup", {
    description: "Prepare the current project with one empty Git baseline after confirmation; existing committed projects are reused.",
    handler: async (_args, ctx) => {
      try {
        const result = await request(ctx);
        if (ctx.hasUI) ctx.ui.notify(result.message, result.state === "setup-blocked" ? "warning" : "info");
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(error instanceof ProjectSetupError ? error.message : "Project setup could not complete; inspect the current folder before retrying.", "error");
      }
    },
  });
  return request;
}
