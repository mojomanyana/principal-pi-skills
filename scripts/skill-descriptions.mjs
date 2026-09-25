import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SKILLS = ["decide", "architect", "plan", "build", "review", "debug", "git-ops"];

function parseFrontmatter(path, text) {
  const block = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  if (!block) throw new Error(`${path}: missing frontmatter`);

  const name = block.match(/^name:\s*([^\n]+)$/m)?.[1].trim();
  const lines = block.split("\n");
  const start = lines.findIndex((line) => /^description:/.test(line));
  if (start < 0) throw new Error(`${path}: missing description`);

  const first = lines[start].replace(/^description:\s*(?:[>|][-+]?\s*)?/, "").trim();
  const continuation = [];
  for (let i = start + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) {
    continuation.push(lines[i].trim());
  }
  const description = [first, ...continuation].filter(Boolean).join(" ");
  if (!description) throw new Error(`${path}: empty description`);
  return { name, description };
}

export function loadSkillDescriptions(root, names = SKILLS) {
  return names.map((expectedName) => {
    const relative = `${expectedName}/SKILL.md`;
    const parsed = parseFrontmatter(relative, readFileSync(join(root, relative), "utf8"));
    if (parsed.name !== expectedName) {
      throw new Error(`${relative}: name "${parsed.name}" does not match "${expectedName}"`);
    }
    return parsed;
  });
}

export function orderedPairs(skills) {
  return skills.flatMap((source) => skills.filter((target) => target !== source).map((target) => [source, target]));
}
