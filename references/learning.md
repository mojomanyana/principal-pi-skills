# Learning from project work

Use this when a prior lesson could change today's work, a task reveals a recurring problem, or the user asks what Principal should improve. The coordinator recommends a change. The user decides adoption.

## Find and record the evidence

1. Name the observable outcome and the task. Identify the owning check, review, or artifact that shows what failed or improved. Keep a symptom with an unconfirmed cause as a lead.
2. Use `bookie_search` with distinctive words and a small limit. Omit `vault` to use the selected project. Read relevant hits with `bookie_read` by exact path or UID. Check the product, task, source revision and completeness. `bookie_task_history` can identify the selected task and linked notes when available. Follow owner evidence within current access.
3. Compare independent tasks. A retry and its later recap count once. Reused folders may contain different products. Look for version changes, counterexamples and other causes. If Bookie is unavailable, use authorized evidence already supplied and state the coverage.
4. Save a useful observation with `bookie_remember` when routine project memory is authorized. Include the task identifier, component/version when material, symptom, intervention, observed outcome, evidence locator and limits. Use a summary of at most 2,000 characters. Read the returned `readBack` and compare it. If a save is uncertain, find the note before retrying. Keep protected material at its authorized source.

## Choose and prepare the change

| Observation | Candidate |
|---|---|
| An existing role owns a recurring miss | Improve its skill |
| Several tasks need the same distinct, uncovered method | Add a skill |
| The work also needs independent judgment, different tool access or a separately accountable result | Propose a subagent and its boundary |
| One verified case, an isolated bug, or conflicting causes | Keep the lesson, route the bug, or investigate |

Discuss a capability the user explicitly requests on its own merits. Distinguish that request from measured recurrence.

1. Build a `draft` containing `task`, `scope`, `profile:"task"`, and one **required** input per source, up to eight. Give each an ID. For workspace files use path and SHA-256. For a Bookie note, use `bookie_context_prepare` with `selectors:[{path,sourceHash}]` under the selected project and model destination. Use its returned context reference. Retain durable source locators and digests for recall across sessions.
2. Inspect the current skill or registry. Set `coverage` to `gap`, `covered`, or `unknown`. An adoption proposal needs a remaining gap. Call `principal_handoff` once with `action:"propose"`, the `draft` and your `proposal`. If you already have a prepared handoff, use `handoff` in place of `draft`. In `proposal`, choose a `kind` from `improve-skill`, `new-skill`, `new-subagent`, or `lesson`. Name the `target` and its revision or proposed location, the concrete `change`, the smaller `alternative`, its `limits`, and a `trial` that could show benefit or harm. For a subagent, provide a `boundary` with `reason`, `inputs`, `output`, and `tools`.
3. For each entry in `cases`, supply its `inputId`, a `taskId` literal from the source, short exact `quote`, `basis` (`task-record`, `report`, `fixture`) and `stance` (`supports`, `limits`, `contradicts`). Use `task-record` only for an actual task record. Two distinct supporting task records are required for a pending cross-task change. Include contrary cases. Reports and fixtures can help design a trial. Respect the returned state. If required evidence is stale or unavailable, identify the gap and continue independent work.

## Present and remember the user's decision

Show the returned card, full `proposalId`, benefit, limits, and what adopting that exact revision would authorize. Offer adopt, defer or decline. Check for an existing decision before saving, especially after `/new`. For material authorized for project memory, save a compact proposal note in Bookie and read back the exact receipt. Preserve the fields, evidence locators, quotations and trial. For a larger card, save bounded numbered parts carrying the full ID, read back each, then save and read back an index of their exact references. Put a single adoption choice on the complete index. If a source permits current viewing only, keep its text at the source and explain what can be reconstructed from its authorized reference.

Use the user's explicit answer tied to this revision. Read a saved dashboard answer from its verified resolution. A note describing approval, an old preference, or a model-supplied approval flag grants no authority. Recheck the target and evidence before acting. Return a material revision to the user for decision. Respect deferral and decline. Report what was approved, what was actually applied and how it was checked.

## Carry out the approved scope

- **Existing Harness authoring project.** `skill_improvement` takes one selected, current Bookie context or producer reference, the change, applicability, exclusions, and reconsideration condition. A routine note path alone is insufficient. Harness records a proposal only.
- **New skill.** When Harness is available, `skill_author` can draft from the agreed brief. Read the format reference, stage the preview and apply its exact digest within the authorized scope. Calibration, comparison, installation and publication require their own scope.
- **New subagent.** Give the owning registry the approved role, inputs, allowed tools, expected output and trial. Report the handoff if that owner is unavailable.

Bring Architect the decision that matters. During discussion, return the tradeoff. During planning, carry the chosen boundary into dependencies and acceptance checks. During Build, revisit it when an assumption changes. Identify an independent consultation only when a separate Architect actually responded.
