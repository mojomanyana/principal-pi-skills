#!/usr/bin/env node
import { realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillDescriptions, orderedPairs } from "./skill-descriptions.mjs";
import { indexBooleanResults, modelJson, routingModel } from "./model-json.mjs";

const systemPrompt = "You audit routing descriptions. For each directed pair, collision=true only when a normal user request clearly inside SOURCE's positive scope could also reasonably trigger TARGET despite either description's exclusions. Shared vocabulary alone is not a collision. Return JSON only: {\"results\":[{\"id\":string,\"collision\":boolean,\"reason\":string}]}. Return every id once.";

export async function auditDescriptionPairs(pairs, request = modelJson, concurrency = 4) {
  const results = new Array(pairs.length);
  let nextPair = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextPair < pairs.length) {
      const index = nextPair++;
      const pair = pairs[index];
      const response = await request([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ pairs: [pair] }) },
      ]);
      const item = indexBooleanResults([pair.id], response.results, "collision").get(pair.id);
      if (typeof item.reason !== "string") throw new Error(`collision response has invalid reason for ${pair.id}`);
      results[index] = { id: pair.id, collision: item.collision, reason: item.reason };
    }
  }));
  return results;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const skills = loadSkillDescriptions(root);
  const pairs = orderedPairs(skills).map(([source, target]) => ({
    id: `${source.name}->${target.name}`,
    source: source.description,
    target: target.description,
  }));
  const results = await auditDescriptionPairs(pairs);
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
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) await main();
