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
        promptGuidelines: ["Batch independent reads with Promise.allSettled and check every result. Run writes and dependent steps in order. Pass returned delegationArguments and statusArguments objects directly, adding the current describe definitionId."],
        prepareLoadout(loadout) {
          const result = tool.prepareLoadout(loadout);
          const { codemode, ...descriptions } = result.descriptions ?? {};
          return { ...result, descriptions: { ...descriptions, principal_codemode: codemode } };
        },
      });
    },
  });
}
