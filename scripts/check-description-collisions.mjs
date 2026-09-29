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

export function aggregateCollisionRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) throw new Error("collision aggregation needs at least one run");
  const ids = runs[0].map((item) => item.id);
  for (const results of runs) {
    if (results.length !== ids.length || results.some((item, index) => item.id !== ids[index])) {
      throw new Error("collision runs must contain the same directed pairs in the same order");
    }
  }
  const hits = ids.map((_, index) => runs.filter((results) => results[index].collision).length);
  return {
    stable: ids.filter((_, index) => hits[index] === runs.length),
    any: ids.filter((_, index) => hits[index] > 0),
    counts: runs.map((results) => results.filter((item) => item.collision).length),
  };
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} needs a value`);
  return value;
}

export function parseRunCount(value) {
  const runCount = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(runCount) || runCount < 1) {
    throw new Error("--runs needs a positive safe integer");
  }
  return runCount;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const skills = loadSkillDescriptions(root);
  const pairs = orderedPairs(skills).map(([source, target]) => ({
    id: `${source.name}->${target.name}`,
    source: source.description,
    target: target.description,
  }));
  const runCount = parseRunCount(optionValue("--runs") ?? "3");
  const runs = [];
  for (let index = 0; index < runCount; index++) runs.push(await auditDescriptionPairs(pairs));

  const output = optionValue("--output");
  if (runCount === 1) {
    const results = runs[0];
    const collisions = results.filter((item) => item.collision);
    const report = { model: routingModel(), pairCount: pairs.length, collisionCount: collisions.length, results };
    if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`description collisions: ${collisions.length}/${pairs.length}`);
    for (const item of collisions) console.log(`  ${item.id}: ${item.reason}`);
    if (collisions.length) process.exitCode = 1;
    return;
  }

  const aggregation = aggregateCollisionRuns(runs);
  const report = {
    model: routingModel(),
    pairCount: pairs.length,
    runCount,
    stable: aggregation.stable,
    any: aggregation.any,
    runs: runs.map((results, index) => ({
      run: index + 1,
      collisionCount: aggregation.counts[index],
      results,
    })),
  };
  if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`STABLE: ${report.stable.length}/${pairs.length}`);
  for (const id of report.stable) console.log(`  ${id}`);
  console.log(`ANY: ${report.any.length}/${pairs.length}`);
  for (const id of report.any) console.log(`  ${id}`);
  console.log(`per-run counts: ${aggregation.counts.join(", ")}`);
  if (report.stable.length) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) await main();
