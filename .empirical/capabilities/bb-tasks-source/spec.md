# Bb Tasks Source Specification

## Purpose

Connect Taskboard to the official BB Tasks plugin as a first-class tracker
source with read, status, and create parity with the existing providers.

## Requirements

### Requirement: BB Tasks tracker selection

Taskboard SHALL offer 'bbtasks' as a tracker source, persist it in project
source configuration together with an optional tasks-project id, and treat it
as a first-class member of the source enumeration everywhere sources are
enumerated.

#### Scenario: Select BB Tasks in Manage

- **WHEN** the user opens Manage for a BB project and chooses BB Tasks
- **THEN** the saved configuration records source 'bbtasks'
- **AND** the board switches to the BB Tasks connector on the next sync

### Requirement: Linked tasks project resolution

The connector SHALL resolve the tasks project whose linkedBbProjectId equals
the BB project when no explicit override is configured, and SHALL expose the
resolved (or overridden) project as the create destination 'Tasks project'.

#### Scenario: Linked project is used automatically

- **GIVEN** a Tasks tracker project PROD is linked to BB project proj_x
- **WHEN** the user selects BB Tasks for proj_x without an override
- **THEN** the board lists PROD tasks and the create dialog defaults to
  PROD as the 'Tasks project' destination

#### Scenario: No linked project

- **WHEN** no Tasks project is linked to the BB project and no override is set
- **THEN** status reports a clear configuration message and list/create
  operations fail gracefully with that guidance

### Requirement: Browse through the Tasks plugin RPC

The connector SHALL list, cache, and fetch tasks through the Tasks plugin RPC
(listProjects, listTasks with pagination, getTaskByKey, listComments,
listLabels) using locally declared schemas, mapping each task to the Taskboard
work item shape with locator equal to the task key.

#### Scenario: Live task detail

- **WHEN** the user opens task PROD-12
- **THEN** Taskboard shows the description, label names, and Markdown comments
  fetched from the Tasks plugin

### Requirement: Real Tasks workflow statuses

Status options SHALL be exactly the six Tasks statuses with state categories
backlog, todo, in_progress, in_progress, done, canceled; moving a status SHALL
call tasks updateTask.

#### Scenario: Move a task to In Review

- **WHEN** the user moves PROD-12 to in_review from the Taskboard board
- **THEN** the connector calls tasks updateTask with status in_review
- **AND** the Tasks application reflects the move through its own realtime
  events without a Taskboard-specific push

### Requirement: Create Tasks issues

The create flow SHALL offer 'Tasks project' as the destination label with
tasks statuses, priorities, labels, and due date as metadata, SHALL create the
issue via tasks createTask, and SHALL attach the task mention for composer
handoff.

#### Scenario: Create a task from Taskboard

- **WHEN** the user confirms a title/description for the PROD project
- **THEN** tasks createTask creates the task and the create result returns the
  new key as the mention payload

### Requirement: Graceful availability

When the Tasks plugin is not installed or disabled, the connector SHALL report
a configuration message naming the fix (install/enable the Tasks plugin) and
SHOULD NOT crash board flows.

#### Scenario: Tasks plugin missing

- **GIVEN** the tasks plugin is not installed
- **WHEN** the user selects BB Tasks
- **THEN** board status shows the install guidance message

### Requirement: Source enumeration includes BB Tasks

Every Taskboard source enumeration — the work source schema, Manage tracker
options, Across projects source filter, and CLI usage text — SHALL include
'bbtasks' with display name 'BB Tasks' and a source glyph.

#### Scenario: Across projects filter

- **WHEN** the user opens the source filter in Across projects
- **THEN** BB Tasks appears next to GitHub, GitLab, Linear, and Jira

#### Scenario: CLI source argument

- **WHEN** an agent runs bb taskboard show bbtasks PROD-12
- **THEN** the command resolves the source and returns the task

### Requirement: Detail external link is optional

Task detail SHALL render the external Open button only when the work item URL
is non-empty, and agent handoff context SHALL render '(BB Tasks task)' in place
of an empty URL.

#### Scenario: BB Tasks detail

- **GIVEN** a cached BB Tasks item with url ''
- **WHEN** the user opens its detail
- **THEN** key, status menu, and Add to chat render while no Open button and
  no broken external link appear

#### Scenario: External providers keep their links

- **GIVEN** a GitHub issue with an html_url
- **WHEN** the user opens its detail
- **THEN** the external Open button still renders and opens the issue URL
