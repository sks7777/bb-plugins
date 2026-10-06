# Decisions: BB Tasks source for Taskboard

## D-001: Source identifier 'bbtasks'

Status: Accepted

### Evidence

Existing sources are single lowercase words ('linear','github','jira',
'gitlab') persisted in SQLite CHECK constraints and typed in CLI usage text.

### Options

- 'bb-tasks' (hyphenated)
- 'bbtasks' (single word)
- 'bb' (ambiguous with the host)

### Chosen approach

'bbtasks': single-word source id matching the existing CLI vocabulary and
schema style.

### Trade-offs and risks

Persisted in CHECK constraints; renaming later would require another migration.

### Verification

contract.test.ts schema acceptance; CLI parsing test.

## D-002: Access Tasks data through plugin RPC, not the CLI

Status: Accepted

### Evidence

The GitHub adapter already calls the official github plugin through
`bb.sdk.plugins.callRpc` with locally re-declared zod schemas; the tasks
plugin registers `tasksRpcContract` the same way.

### Options

- execFile the `bb tasks` CLI per operation.
- bb.sdk.plugins.callRpc to pluginId 'tasks'.

### Chosen approach

callRpc: in-process HTTP, host-validated input/output, structured errors, no
extra process per operation.

### Trade-offs and risks

Schemas are duplicated locally and can drift from the Tasks plugin; the Tasks
plugin must be installed for the source to work (explicit availability
messaging).

### Verification

sources-bb-tasks.test.ts fake-callRpc flows; unavailable-plugin error paths.

## D-003: Status moves via updateTask, not boardMove

Status: Accepted

### Evidence

updateTask changes status plainly; boardMove also writes a system comment and
orders the card within a column.

### Options

- boardMove with authorName 'Taskboard'.
- updateTask {taskId, status, authorName:'Taskboard'}.

### Chosen approach

updateTask: neutral status change without fabricating board activity or
ordering that Taskboard's cache cannot mirror.

### Trade-offs and risks

Tasks app ordering stays 'manual' default; acceptable because Taskboard does
not manage Tasks ordering.

### Verification

adapter updateStatus test asserts the updateTask payload.

## D-004: Migration recreates source-constrained tables

Status: Accepted

### Evidence

SQLite CHECK constraints cannot be widened in place; the gitlab migration
already established the recreate-and-copy pattern for the same tables.

### Options

- Recreate the three tables with the widened CHECK.
- Drop CHECK constraints entirely.

### Chosen approach

Recreate work_items_by_project, source_sync_by_project, project_source_config
with 'bbtasks' added and the new bb_tasks_project_id column; copy rows and
recreate indexes exactly as the gitlab migration did.

### Trade-offs and risks

Downgrading the plugin with cached 'bbtasks' rows would fail the old CHECK on
recreation — accepted, same class of risk as the gitlab addition.

### Verification

store migration upgrade test on a seeded pre-migration database; root check.

## D-005: Destination resolution by linked project with explicit override

Status: Accepted

### Evidence

Tasks projects carry linkedBbProjectId; Taskboard projects select one tracker
and already persist per-provider configuration fields.

### Options

- Always require an explicit project pick.
- Auto-resolve the linked project, allow an explicit override.

### Chosen approach

Config field bbTasksProjectId ('' = auto). Auto resolves the tracker project
whose linkedBbProjectId equals the BB project; Manage exposes the picker
(mark the linked project) when absent or ambiguous; create context defaults
the destination to the resolved project.

### Trade-offs and risks

Multiple linked projects make auto-resolution ambiguous — the picker resolves
it explicitly; empty state surfaces guidance instead of guessing.

### Verification

adapter destination tests; create-context message tests.
