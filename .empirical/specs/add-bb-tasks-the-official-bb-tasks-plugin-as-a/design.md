# BB Tasks Source Design

## Overview

BB Tasks joins Taskboard as a fifth WorkSource by following the plugin-RPC
pattern the GitHub adapter already established: the adapter lives entirely in
the Taskboard plugin, declares its own zod schemas for the Tasks plugin's RPC
contract, and calls it through `bb.sdk.plugins.callRpc({pluginId: 'tasks'})`.
No new dependency, no credentials, no bb-app changes, no Tasks-plugin changes.

## RPC access layer (`sources/bb-tasks.ts`)

- Local zod schemas mirror the Tasks plugin contract: ULID id pattern
  (`/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/`), task (key, title, description, status,
  priority, dueDate, labelIds, timestamps), project (id, name, prefix,
  linkedBbProjectId), comment (authorName, body, createdAt, kind), label.
- Every call uses `bb.sdk.plugins.callRpc({pluginId:'tasks', method, input,
  outputSchema})`; mutation results are the Tasks `taskMutationResult`
  discriminated union — the adapter unwraps `ok:false` into thrown errors with
  the domain message.
- The adapter factory accepts an optional `callRpc` override for tests; the
  default binds `bb.sdk.plugins.callRpc`.
- Availability: `configured()` probes `listProjects` once per adapter instance
  (memoized promise). A failed probe (plugin missing/disabled) yields
  `configured:false` and the message "Install and enable the BB Tasks plugin
  (bb plugin install tasks)". A later probe is retried when the adapter is
  rebuilt after a revision bump.

## Mapping

- `locator` = task key (`PROD-12`). `get()` resolves via `getTaskByKey`, then
  fetches `listComments(taskId)` and `listLabels(projectId)` (label names
  cached per adapter instance) to build `WorkItemDetail`.
- `list()` pages `listTasks` (limit 500, loop while `nextCursor`) with
  `sort: 'manual'`, capped at 2000 items, mapping label ids to names.
- Status options: the six fixed Tasks statuses; `stateCategory` mapping
  backlog→backlog, todo→todo, in_progress→in_progress, in_review→in_progress,
  done→done, canceled→canceled; `current` from the task's status.
- `updateStatus()` = `updateTask {taskId, status, authorName:'Taskboard'}`.
- `createMetadata()` = six statuses, five priorities, `listLabels` options,
  `supportsDueDate:true`, empty assignee/milestone/issueType lists,
  `defaultStatusId:'todo'`.
- `create()` = `createTask {projectId, title, description, status, priority,
  dueDate, labelIds}`; `assigneeConfirmation {confirmed:true, id:null}`;
  warnings `[]`.
- `WorkItem.url` = `''`; `project` = tasks project name; `priority` = enum
  string; `assignee` = null.
- Destination resolution: `listProjects` → projects where
  `linkedBbProjectId === bbProjectId`; with config `bbTasksProjectId` set, that
  id wins; exactly one linked project without override is the default
  destination; the create-context destination label is 'Tasks project'.

## Store migration (`store.ts`)

One new migration statement recreates the three source-constrained tables —
`work_items_by_project`, `source_sync_by_project`, `project_source_config` —
with `CHECK (source IN ('linear','github','jira','gitlab','bbtasks'))` and adds
`bb_tasks_project_id TEXT NOT NULL DEFAULT ''` to `project_source_config`.
Row copy, index recreation, and table drop/rename follow the proven gitlab
migration shape. `rowToConfig`, `saveProjectConfig`, and column lists gain the
new field.

## Server wiring (`server.ts`)

- `SOURCES` gains `'bbtasks'`; `DEFAULT_PROJECT_CONFIG` gains
  `bbTasksProjectId: ''`.
- `adapters()` branch: `createBbTasksAdapter(bb, true, projectId,
  config.bbTasksProjectId)`.
- `getCreateIssueContext`: destinationLabel `'Tasks project'`; destinations
  from the adapter's resolved project list (linked first, chosen next);
  `missingDestinationMessage` when none; `allowsCustomDestination:false`.
- `changedSources`/`sameProjectConfig` compare `bbTasksProjectId`.
- CLI: usage strings list `bbtasks`; `config` gains `--bb-tasks-project
  <prefix-or-id>`; parsing accepts prefix or ULID and persists the resolved
  id.

## UI (`app.tsx`)

- `SOURCE_FILTER_OPTIONS`, `TRACKER_OPTIONS`, `isWorkSource`, `sourceName`
  gain `bbtasks`/`'BB Tasks'`; `SourceGlyph` renders a compact 'BT' badge in
  the provider accent.
- Manage shows a tasks-project picker when `source==='bbtasks'` fed by
  `config.bbTasksProjects` (linked project marked 'auto').
- Detail renders the external Open button only for non-empty `item.url`.
- `formatWorkItemContext` prints `(BB Tasks task)` for empty URLs.

## Testing

- `test/sources-bb-tasks.test.ts`: mapping helpers (status category, key
  parse/format), adapter flows against a fake `callRpc` (list pagination, get
  with comments/labels, statusOptions, createMetadata, create, updateStatus,
  plugin-unavailable errors, ok:false unwrapping).
- `test/contract.test.ts`: schema accepts 'bbtasks', destinationLabel
  'Tasks project', config view fields.
- Existing tests stay green (`node --test test/*.test.ts`).

## Risks and trade-offs

- CHECK-table recreation is the accepted downgrade risk (D6).
- `in_review` collapses into `in_progress` categories, matching Linear's
  started-type handling (D7).
- The Tasks plugin must be installed; availability messaging is explicit (D9).
