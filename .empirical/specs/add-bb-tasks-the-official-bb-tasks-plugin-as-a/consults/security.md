# BB Tasks Source Security Consult

- Specialist: `security`
- Verdict: `advisory`

## Scope

The diff adds the 'bbtasks' WorkSource: a plugin-RPC adapter, a SQLite CHECK
migration, server/CLI wiring, and UI surfaces. It stores no new secrets.

## Findings

None blocking.

- Credential exposure: the adapter stores no tokens or API keys; all data
  access goes through the Tasks plugin's host-validated RPC
  (`bb.sdk.plugins.callRpc`), reusing the host's local-auth semantics. The
  Tasks plugin owns its database and credentials remain out of scope here.
- External-data trust boundary: task titles/descriptions/comments flow through
  the existing `formatWorkItemContext` delimiters and control-character
  escaping; the new URL-empty branch renders a static placeholder only. No new
  injection surface: CLI outputs go through the same escape helpers.
- Migration: a recreate-and-copy migration cannot execute attacker-controlled
  SQL (statement is repository-authored); no dynamic SQL construction anywhere
  in the diff.
- Injection into bb project ids: `bbTasksProjectId` is only compared against
  the Tasks RPC's ULID ids or echoed into zsh only through argument vectors
  built with execFile-style spawning (plugin CLI), not shell strings; the CLI
  value is validated non-empty and resolved against the project list before
  persistence.

## Residual risk

Trust in the Tasks plugin's own authorization model (any server-local caller
may read/move tasks through its RPC). The linked-project auto-resolution means
a Tasks project linked to the BB project becomes visible to that project's
Taskboard board — consistent with the Tasks plugin's intended usage.
