// Reuse Pi's native executor with tool calls only. The built-in codemode is left untouched.
import * as agent from "@earendil-works/pi-coding-agent";

export default function principalCodemode(pi) {
  if (typeof agent.createCodemodeExtension !== "function") return;
  agent.createCodemodeExtension({ mode: "on", models: false })({
    getSettings: () => pi.getSettings(),
    getAllTools: () => pi.getAllTools(),
    appendEntry: (...args) => pi.appendEntry(...args),
    registerTool(tool) {
      pi.registerTool({
        ...tool,
        name: "principal_codemode",
        label: "Principal tools",
        defaultActive: true,
        promptGuidelines: ["Batch independent inspection with Promise.allSettled and inspect every result. Sequence writes and dependent work. Use principal_workflow for candidate and artifact bookkeeping; its checks also apply outside scripts."],
        prepareLoadout(loadout) {
          const result = tool.prepareLoadout(loadout);
          const { codemode, ...descriptions } = result.descriptions ?? {};
          return { ...result, descriptions: { ...descriptions, principal_codemode: codemode } };
        },
      });
    },
  });
}
