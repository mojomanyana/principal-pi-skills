#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillDescriptions, SKILLS } from "./skill-descriptions.mjs";
import { indexBooleanResults, modelJson, routingModel } from "./model-json.mjs";

const RUNS = 3;
const THRESHOLD = 0.5;

export function expandAdversarialCases(queries, skillNames = SKILLS) {
  return queries.flatMap((item) => skillNames.map((skill) => ({
    id: `${item.id}:${skill}`,
    queryId: item.id,
    skill,
    positive: item.intended === skill || (item.intended === "AMBIGUOUS" && item.acceptable.includes(skill)),
    query: item.query,
  })));
}

export function evaluateAdversarialQueries(queries, verdicts) {
  const result = { collisions: {}, hardNegatives: { actualMisrouting: false, failingQueries: [] } };
  for (const item of queries) {
    const selected = verdicts.filter((verdict) => verdict.queryId === item.id && verdict.selected).map((verdict) => verdict.skill);
    const failed = item.intended === "NO_SKILL"
      ? selected.length > 0
      : item.intended === "AMBIGUOUS"
        ? selected.length === 0 || selected.some((skill) => !item.acceptable.includes(skill))
        : selected.length !== 1 || selected[0] !== item.intended;
    if (!failed) continue;
    const finding = { id: item.id, query: item.query, intended: item.intended, selected };
    if (item.category === "hard-negative") {
      result.hardNegatives.actualMisrouting = true;
      result.hardNegatives.failingQueries.push(finding);
    } else {
      result.collisions[item.collision] ??= { actualMisrouting: false, failingQueries: [] };
      result.collisions[item.collision].actualMisrouting = true;
      result.collisions[item.collision].failingQueries.push(finding);
    }
  }
  for (const collision of new Set(queries.map((item) => item.collision).filter(Boolean))) {
    result.collisions[collision] ??= { actualMisrouting: false, failingQueries: [] };
  }
  return result;
}

export function scoreTriggerRuns(cases, runs, skillNames = SKILLS, threshold = THRESHOLD) {
  return Object.fromEntries(skillNames.map((skill) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (const item of cases.filter((candidate) => candidate.skill === skill)) {
      const selected = runs.filter((run) => run[item.id] === true).length / runs.length >= threshold;
      if (item.positive && selected) truePositive++;
      if (!item.positive && selected) falsePositive++;
      if (item.positive && !selected) falseNegative++;
    }
    return [skill, {
      truePositive,
      falsePositive,
      falseNegative,
      precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0,
      recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0,
    }];
  }));
}

export function validateTriggerCorpus(
  cases,
  adversarial,
  skillNames = SKILLS,
  expectedCollisions = ["decide->architect", "debug->git-ops", "git-ops->debug"],
) {
  const ids = new Set();
  for (const item of cases) {
    if (typeof item.id !== "string" || !item.id) throw new Error("base trigger id must be a non-empty string");
    if (typeof item.query !== "string" || !item.query) throw new Error(`${item.id}: query must be a non-empty string`);
    if (!skillNames.includes(item.skill)) throw new Error(`${item.id}: unknown skill ${item.skill}`);
    if (typeof item.positive !== "boolean") throw new Error(`${item.id}: positive must be boolean`);
    if (ids.has(item.id)) throw new Error(`duplicate trigger id ${item.id}`);
    ids.add(item.id);
  }
  for (const item of adversarial) {
    if (typeof item.id !== "string" || !item.id) throw new Error("adversarial trigger id must be a non-empty string");
    if (typeof item.query !== "string" || !item.query) throw new Error(`${item.id}: query must be a non-empty string`);
    if (ids.has(item.id)) throw new Error(`duplicate trigger id ${item.id}`);
    ids.add(item.id);
  }
  for (const skill of skillNames) {
    const own = cases.filter((item) => item.skill === skill);
    const positives = own.filter((item) => item.positive).length;
    if (own.length !== 20 || positives !== 12) {
      throw new Error(`${skill}: expected 20 triggers with a 12/8 positive/negative split, got ${positives}/${own.length - positives}`);
    }
  }
  for (const item of adversarial) {
    if (item.category === "hard-negative") {
      if (item.intended !== "NO_SKILL" || item.collision !== undefined || item.acceptable !== undefined) {
        throw new Error(`${item.id}: hard-negative must have only the NO_SKILL routing label`);
      }
      continue;
    }
    if (item.category !== undefined) throw new Error(`${item.id}: unknown category ${item.category}`);
    if (!expectedCollisions.includes(item.collision)) throw new Error(`${item.id}: unknown collision ${item.collision}`);
    const pair = item.collision.split("->");
    if (item.intended === "AMBIGUOUS") {
      if (!Array.isArray(item.acceptable) || pair.some((skill) => !item.acceptable.includes(skill)) || item.acceptable.length !== 2) {
        throw new Error(`${item.id}: AMBIGUOUS query must accept exactly both colliding skills`);
      }
    } else {
      if (item.acceptable !== undefined) throw new Error(`${item.id}: acceptable is valid only when intended is AMBIGUOUS`);
      if (!pair.includes(item.intended)) {
        throw new Error(`${item.id}: intended label ${item.intended} is outside ${item.collision}`);
      }
    }
  }
  for (const collision of expectedCollisions) {
    const count = adversarial.filter((item) => item.collision === collision).length;
    if (count < 8) throw new Error(`${collision}: expected at least 8 adversarial queries, got ${count}`);
  }
  if (!adversarial.some((item) => item.category === "hard-negative")) throw new Error("expected hard-negative NO_SKILL queries");

  const generatedIds = new Set(cases.map((item) => item.id));
  for (const item of expandAdversarialCases(adversarial, skillNames)) {
    if (generatedIds.has(item.id)) throw new Error(`duplicate generated trigger id ${item.id}`);
    generatedIds.add(item.id);
  }
}

export function buildTriggerPayload(skills, cases) {
  return {
    descriptions: Object.fromEntries(skills.map((skill) => [skill.name, skill.description])),
    cases: cases.map((item, index) => ({
      id: `q${String(index + 1).padStart(3, "0")}`,
      skill: item.skill,
      query: item.query,
    })),
  };
}

async function classify(skills, cases) {
  const payload = buildTriggerPayload(skills, cases);
  const response = await modelJson([
    {
      role: "system",
      content: "You test skill routing. For each case, decide whether its candidate skill description should trigger for the user query. Apply the positive scope and every Not-for boundary literally. A related topic is not enough. Return JSON only: {\"results\":[{\"id\":string,\"trigger\":boolean}]}. Return every id once.",
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ]);
  const byId = indexBooleanResults(payload.cases.map((item) => item.id), response.results, "trigger");
  return Object.fromEntries(cases.map(({ id }, index) => [id, byId.get(payload.cases[index].id).trigger]));
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const skills = loadSkillDescriptions(root);
  const originalCases = JSON.parse(readFileSync(join(root, "evals/triggers.json"), "utf8"));
  const adversarialQueries = JSON.parse(readFileSync(join(root, "evals/adversarial-triggers.json"), "utf8"));
  validateTriggerCorpus(originalCases, adversarialQueries);
  const adversarialCases = expandAdversarialCases(adversarialQueries);
  const cases = [...originalCases, ...adversarialCases];
  const runs = await Promise.all(Array.from({ length: RUNS }, () => classify(skills, cases)));
  const metrics = scoreTriggerRuns(cases, runs);
  const verdicts = cases.map((item) => {
    const triggerVotes = runs.filter((run) => run[item.id]).length;
    return { ...item, triggerVotes, selected: triggerVotes / RUNS >= THRESHOLD };
  });
  const adversarialVerdicts = evaluateAdversarialQueries(adversarialQueries, verdicts.filter((item) => item.queryId));
  const perfect = Object.values(metrics).every((score) => score.precision === 1 && score.recall === 1);
  const perfectScoreFinding = perfect
    ? "All expanded scores remain 1.000; the suite is not exposing model disagreement beyond its authored collision-boundary and no-skill probes."
    : null;
  const report = {
    model: routingModel(),
    runs: RUNS,
    threshold: THRESHOLD,
    corpus: `${originalCases.length} original binary probes + ${adversarialQueries.length} adversarial queries across all seven skills`,
    metrics,
    adversarial: adversarialVerdicts,
    perfectScoreFinding,
    verdicts,
  };
  const outputArg = process.argv.indexOf("--output");
  if (outputArg >= 0) {
    const path = process.argv[outputArg + 1];
    if (!path) throw new Error("--output needs a path");
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  }
  for (const [skill, score] of Object.entries(metrics)) {
    console.log(`${skill}: precision=${score.precision.toFixed(3)} recall=${score.recall.toFixed(3)} (tp=${score.truePositive} fp=${score.falsePositive} fn=${score.falseNegative})`);
  }
  if (perfectScoreFinding) console.log(`FINDING: ${perfectScoreFinding}`);
  for (const [collision, result] of Object.entries(adversarialVerdicts.collisions)) {
    console.log(`${collision}: actual misrouting=${result.actualMisrouting ? "YES" : "NO"}`);
    for (const failure of result.failingQueries) console.log(`  ${failure.id}: ${failure.query}`);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) await main();
