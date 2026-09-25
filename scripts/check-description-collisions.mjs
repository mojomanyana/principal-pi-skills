#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillDescriptions, orderedPairs } from "./skill-descriptions.mjs";
import { indexBooleanResults, modelJson, routingModel } from "./model-json.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const skills = loadSkillDescriptions(ROOT);
const pairs = orderedPairs(skills).map(([source, target]) => ({
  id: `${source.name}->${target.name}`,
  source: source.description,
  target: target.description,
}));

const response = await modelJson([
  {
    role: "system",
    content: "You audit routing descriptions. For each directed pair, collision=true only when a normal user request clearly inside SOURCE's positive scope could also reasonably trigger TARGET despite either description's exclusions. Shared vocabulary alone is not a collision. Return JSON only: {\"results\":[{\"id\":string,\"collision\":boolean,\"reason\":string}]}. Return every id once.",
  },
  { role: "user", content: JSON.stringify({ pairs }) },
]);

const byId = indexBooleanResults(pairs.map((pair) => pair.id), response.results, "collision");
const results = pairs.map(({ id }) => {
  const item = byId.get(id);
  if (typeof item.reason !== "string") throw new Error(`collision response has invalid reason for ${id}`);
  return { id, collision: item.collision, reason: item.reason };
});
const collisions = results.filter((item) => item.collision);
const report = { model: routingModel(), pairCount: pairs.length, collisionCount: collisions.length, results };
const outputArg = process.argv.indexOf("--output");
if (outputArg >= 0) {
  const path = process.argv[outputArg + 1];
  if (!path) throw new Error("--output needs a path");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`description collisions: ${collisions.length}/${pairs.length}`);
for (const item of collisions) console.log(`  ${item.id}: ${item.reason}`);
if (collisions.length) process.exitCode = 1;
