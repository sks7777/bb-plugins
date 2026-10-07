# BB Tasks tracker source for Taskboard

## Request

> Add BB Tasks (the official bb 'tasks' plugin) as a fifth tracker source 'bbtasks' in the taskboard plugin, at full parity with GitHub/GitLab/Linear/Jira. Approved plan: plans/2026-10-06_21-07_bb-tasks-taskboard-source.md.

## Goal

A BB project can select BB Tasks as its tracker in Taskboard Manage; the board
lists that tasks project's tasks, shows live details, moves real Tasks
statuses, and creates Tasks issues, all through the Tasks plugin's registered
RPC contract with no stored credentials and no new external dependencies.

## Acceptance Criteria

- [ ] [AC-1] Manage lists BB Tasks ('BB Tasks') as a selectable tracker for a
  BB project; saving persists source 'bbtasks' plus an optional tasks-project
  override; the selection survives reload.
- [ ] [AC-2] With source 'bbtasks' selected, the board lists tasks of the
  tasks project linked to that BB project (fallback: the explicitly chosen
  project): key, title, status, priority, labels, and updated time come from
  the Tasks plugin RPC and are cached by the existing per-project sync.
- [ ] [AC-3] Opening a task fetches live detail: description, labels (label
  ids resolved to names), and Markdown comments via getTaskByKey +
  listComments + listLabels.
- [ ] [AC-4] Status options are the six Tasks statuses (backlog, todo,
  in_progress, in_review, done, canceled) with state categories backlog, todo,
  in_progress, in_progress, done, canceled; moving a status calls
  tasks updateTask and the Tasks app reflects it through its own realtime
  events.
- [ ] [AC-5] Create-issue flow offers destination label 'Tasks project' with
  the linked project as default; metadata offers the six statuses, five
  priorities, project labels, and due date; no assignee/milestone/issue-type
  fields are offered; confirming calls createTask and returns a mention that
  hands the task key to the composer.
- [ ] [AC-6] When the Tasks plugin is not installed, disabled, or no tasks
  project is linked, board status shows a clear configuration message and
  list/create fail gracefully without crashes.
- [ ] [AC-7] The SQLite migration preserves existing rows, accepts 'bbtasks'
  in all source CHECK constraints, and adds bb_tasks_project_id to
  project_source_config; an existing pre-migration database upgrades without
  data loss.
- [ ] [AC-8] bb taskboard CLI (status/list/show/transitions/move/refresh/config)
  accepts the bbtasks source and bb taskboard config supports
  --bb-tasks-project.
- [ ] [AC-9] contract and adapter unit tests cover schema acceptance, status
  mapping, locator parsing, list/get/create/updateStatus flows with a fake
  callRpc, pagination, and plugin-unavailable errors; root npm run check passes.
- [ ] [AC-UI-1] [UI] Taskboard Manage shows the BB Tasks option with a source
  glyph and name; rows and detail show the BB Tasks mark.
- [ ] [AC-UI-2] [UI] When the selected source is bbtasks, Manage shows a
  tasks-project picker listing tracker projects (linked project marked);
  Across projects filter includes BB Tasks.
- [ ] [AC-UI-3] [UI] Task detail hides the external Open button when the item
  URL is empty (BB Tasks tasks have no external URL) and still shows key,
  status menu, and Add to chat.

## Scope

- plugins/taskboard: contract.ts, credential-contract.ts (config schemas),
  sources/bb-tasks.ts (new), sources/types.ts (no interface change),
  store.ts (migration + config mapping), server.ts (wiring, create-issue
  context, CLI), app.tsx (source surfaces), tests, README, package.json
  version/keywords.
- Data access exclusively through bb.sdk.plugins.callRpc(pluginId 'tasks') to
  the Tasks plugin's registered RPC contract; locally re-declared zod schemas
  (no cross-package imports).

## Non-goals

- Task deletion, subtask management, delegation, presets, attachments, or
  comment writing through Taskboard.
- Assignee, milestone, issue-type, or estimate fields (Tasks has none).
- A deep link or external URL for Tasks items.
- boardMove ordering/positioning and board system comments (updateTask only).
- Changes to the Tasks plugin itself; any new bb-app surface.

## Verification

- Root workspace checks (npm install; npm run check) per repository policy.
- Focused node:test files: test/contract.test.ts, new
  test/sources-bb-tasks.test.ts.
- Live BB UI evidence: reload the plugin in BB, select BB Tasks for a project,
  verify board/detail/create/status-move with screenshots (browserForUi).
- Downgrade risk is documented and accepted (see decisions).

## Capability Deltas

- deltas/bb-tasks-source.md (ADDED — new capability: the BB Tasks tracker
  connection surface).
- deltas/taskboard-browser.md (MODIFIED — source enumeration, glyph/name
  surfacing, and empty-URL detail behavior across sources).
