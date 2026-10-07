# Plan: BB Tasks source for Taskboard

## 1. Establish the working baseline

- Run `npm install` and record pre-change `npm run check` status (types,
  typecheck, tests, build, verify-build) for the worktree checkout.
- Confirm the pinned SDK surface used by the GitHub adapter
  (`bb.sdk.plugins.callRpc`) and the Tasks plugin RPC contract fields to mirror
  (listProjects, listTasks, getTaskByKey, listComments, listLabels, createTask,
  updateTask; TASK_STATUSES, TASK_PRIORITIES).

## 2. Contract layer (contract.ts, credential-contract.ts)

- Add 'bbtasks' to `workSourceSchema`; export `BB_TASKS_SOURCE` name mapping
  in `sourceName()` → 'BB Tasks'.
- `projectSourceConfigSchema`: add `bbTasksProjectId: z.string().trim()`
  (empty = auto); `projectConfigMutationSchema` inherits it.
- `projectConfigViewSchema`: add `bbTasksProjects` — array of
  `{id, name, prefix, linkedBbProjectId}` for the Manage picker.
- `createIssueContextSchema.destinationLabel`: add `'Tasks project'`.
- `formatWorkItemContext`: render '(BB Tasks task)' for an empty URL.
- Extend `test/contract.test.ts`: enum acceptance, destinationLabel, config
  view/mutation fields round-trip.

## 3. Adapter (sources/bb-tasks.ts, new)

- Local zod schemas: ULID ids, tasks task/project/label/comment shapes,
  mutation-result union, listProjects response.
- Pure helpers exported for tests: `taskStateCategory(status)`,
  `taskLocator(key)`/`parseTaskLocator`, key validation, status option list.
- `createBbTasksAdapter(bb, enabled, bbProjectId, bbTasksProjectId, callRpc?)`
  implementing `WorkSourceAdapter`:
  memoized `configured()` probe on `listProjects`; `list()` with 500-per-page
  pagination (cap 2000) and label-name resolution; `get()` via getTaskByKey +
  listComments + listLabels; `statusOptions()` fixed six statuses with
  category mapping; `createMetadata()` statuses/priorities/labels + due date;
  `create()` via createTask returning key mention-ready item; `updateStatus()`
  via updateTask; graceful configurationMessage when the plugin is missing.
- Add `test/sources-bb-tasks.test.ts` with a fake callRpc covering: probe
  unavailable, list pagination, detail with comments/labels, statusOptions,
  createMetadata, create, updateStatus, ok:false error unwrapping.

## 4. Store migration (store.ts)

- Append the recreation migration: work_items_by_project,
  source_sync_by_project, project_source_config with
  `source IN ('linear','github','jira','gitlab','bbtasks')` and
  `bb_tasks_project_id TEXT NOT NULL DEFAULT ''`; copy rows; recreate the
  documented indexes.
- Update rowToConfig/saveProjectConfig column lists and type maps.

## 5. Server wiring (server.ts)

- SOURCES += 'bbtasks'; DEFAULT_PROJECT_CONFIG.bbTasksProjectId = ''.
- adapters(): createBbTasksAdapter branch.
- getCreateIssueContext: destinationLabel 'Tasks project', destinations from
  the resolved project list (linked first), missing-destination message,
  allowsCustomDestination false.
- changedSources/sameProjectConfig: compare bbTasksProjectId.
- CLI: usage strings + config --bb-tasks-project parsing (prefix or ULID),
  persistence, and validation errors.

## 6. UI (app.tsx)

- SOURCE_FILTER_OPTIONS, TRACKER_OPTIONS (description 'Linked Tasks projects'),
  isWorkSource, sourceName, SourceGlyph 'BT' badge.
- Manage: tasks-project picker when source==='bbtasks' fed from
  config.bbTasksProjects; linked project marked; override saves
  bbTasksProjectId.
- Detail: render Open button only when item.url is non-empty.

## 7. Docs and version

- README: BB Tasks section (install Tasks plugin, linked-project resolution,
  statuses table, no credentials), keywords, version 0.4.0.
- Root README catalog stays aligned if it enumerates sources.

## 8. Verification

- `npm run check` from the workspace root (types, typecheck, tests, build,
  verify-build) — record as evidence.
- Live BB verification: `bb plugin install ./plugins/taskboard` +
  `bb plugin reload taskboard`; select BB Tasks for a project; verify board
  list, detail, status move, create; capture screenshots (browserForUi).
- Local review pass (fresh-context reviewer per policy) and fixes.

## 9. Integration

- Commit on the feature branch; integrate per policy against the independent
  target; open the delivery PR with migration + Tasks-plugin notes.
