import type { BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
import type {
  BbTasksProjectSummary,
  WorkStateCategory
} from '../contract.js';
import type {
  ExternalWorkItem,
  ExternalWorkItemCreateInput,
  ExternalWorkItemCreateMetadataInput,
  ExternalWorkItemCreateResult,
  ExternalWorkItemDetail,
  ExternalWorkStatusOption,
  WorkSourceAdapter
} from './types.js';
import { withoutComments } from './types.js';

/**
 * BB Tasks source adapter.
 *
 * Data access goes through the official Tasks plugin's registered RPC
 * contract via `bb.sdk.plugins.callRpc({pluginId: 'tasks'})` — the same
 * pattern the GitHub adapter uses for the github plugin. Taskboard stores no
 * credentials: the Tasks plugin owns its own database.
 *
 * The Tasks statuses are fixed (backlog, todo, in_progress, in_review, done,
 * canceled); `in_review` collapses into the `in_progress` work state category,
 * matching how Linear's started states are handled. Task keys (PROD-12) are
 * the item locators; the Tasks plugin resolves them case-insensitively and
 * keeps aliases for tasks that moved between projects.
 */

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;
const TASK_KEY_PATTERN = /^([A-Za-z][A-Za-z0-9]{0,9})-(\d+)$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export const TASKS_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled'
] as const;
export type TasksStatus = (typeof TASKS_STATUSES)[number];

export const TASKS_PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export type TasksPriority = (typeof TASKS_PRIORITIES)[number];

const TASKS_STATUS_NAMES: Record<TasksStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  canceled: 'Canceled'
};

export function tasksStateCategory(status: TasksStatus): WorkStateCategory {
  if (status === 'in_review') return 'in_progress';
  if (status === 'backlog') return 'backlog';
  if (status === 'todo') return 'todo';
  if (status === 'done') return 'done';
  if (status === 'canceled') return 'canceled';
  return 'in_progress';
}

export function formatTasksStatusName(status: TasksStatus): string {
  return TASKS_STATUS_NAMES[status];
}

export function isValidTaskKey(value: string): boolean {
  return TASK_KEY_PATTERN.test(value.trim());
}

export const TASKS_LIST_PAGE_LIMIT = 500;
export const TASKS_LIST_TOTAL_LIMIT = 2000;

const PLUGIN_MISSING_MESSAGE =
  'Install and enable the Tasks plugin (bb plugin install tasks) to use BB Tasks as a tracker.';

// ---------------------------------------------------------------------------
// Locally declared schemas for the Tasks plugin RPC contract.
// ---------------------------------------------------------------------------

const tasksIdSchema = z.string().regex(ULID_PATTERN, 'must be a ULID');

const tasksStatusSchema = z.enum(TASKS_STATUSES);
const tasksPrioritySchema = z.enum(TASKS_PRIORITIES);

const tasksTaskSchema = z
  .object({
    id: tasksIdSchema,
    projectId: tasksIdSchema,
    number: z.number().int().positive(),
    key: z.string().min(1),
    title: z.string(),
    description: z.string(),
    status: tasksStatusSchema,
    priority: tasksPrioritySchema,
    dueDate: z
      .string()
      .regex(ISO_DATE_PATTERN)
      .nullable()
      .optional()
      .default(null),
    parentTaskId: tasksIdSchema.nullable().optional().default(null),
    createdAt: z.string(),
    updatedAt: z.string(),
    labelIds: z.array(tasksIdSchema).optional().default([])
  })
  .passthrough();

const tasksLabelSchema = z
  .object({
    id: tasksIdSchema,
    name: z.string().min(1)
  })
  .passthrough();

const tasksCommentSchema = z
  .object({
    authorName: z.string(),
    body: z.string(),
    createdAt: z.string().min(1)
  })
  .passthrough();

const tasksProjectSchema = z
  .object({
    id: tasksIdSchema,
    name: z.string(),
    prefix: z.string().min(1),
    linkedBbProjectId: z.string().startsWith('proj_').nullable().optional().default(null)
  })
  .passthrough();

const tasksDomainErrorSchema = z
  .object({
    code: z.string(),
    message: z.string()
  })
  .passthrough();

const taskMutationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), task: tasksTaskSchema }).strict(),
  z.object({ ok: z.literal(false), error: tasksDomainErrorSchema }).strict()
]);

const listTasksResponseSchema = z
  .object({
    tasks: z.array(tasksTaskSchema),
    nextCursor: z.string().nullable()
  })
  .passthrough();

const listProjectsResponseSchema = z
  .object({ projects: z.array(tasksProjectSchema) })
  .passthrough();

const getTaskResponseSchema = z
  .object({ task: tasksTaskSchema.nullable() })
  .passthrough();

const listLabelsResponseSchema = z
  .object({ labels: z.array(tasksLabelSchema) })
  .passthrough();

const listCommentsResponseSchema = z
  .object({ comments: z.array(tasksCommentSchema) })
  .passthrough();

const tasksStatuses = TASKS_STATUSES;
const tasksPriorities = TASKS_PRIORITIES;

export interface BbTasksResolvedProject {
  project: z.infer<typeof tasksProjectSchema>;
  basis: 'override' | 'linked';
}

export interface BbTasksResolution {
  projects: z.infer<typeof tasksProjectSchema>[];
  resolved: BbTasksResolvedProject | null;
  problem: string | null;
  probeError: string | null;
}

export type BbTasksRpcCaller = <TOutput>(args: {
  pluginId: string;
  method: string;
  input: unknown;
  outputSchema: { parse(value: unknown): TOutput };
}) => Promise<TOutput>;

function defaultCallRpc(
  bb: BbPluginApi
): BbTasksRpcCaller {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (bb.sdk as any).plugins.callRpc.bind(bb.sdk.plugins);
}

function tasksDomainMessage(error: z.infer<typeof tasksDomainErrorSchema>): string {
  return error.message || error.code || 'Tasks plugin rejected the change';
}

export function resolveTasksProject(
  projects: z.infer<typeof tasksProjectSchema>[],
  bbProjectId: string,
  overrideId: string
): { resolved: BbTasksResolvedProject | null; problem: string | null } {
  const trimmed = overrideId.trim();
  if (trimmed) {
    const override = projects.find(project => project.id === trimmed);
    if (!override) {
      const byPrefix = projects.find(
        project => project.prefix.toLowerCase() === trimmed.toLowerCase()
      );
      if (byPrefix) return { resolved: { project: byPrefix, basis: 'override' }, problem: null };
      return {
        resolved: null,
        problem: `Configured BB Tasks project "${trimmed}" was not found; pick a current project in Manage.`
      };
    }
    return { resolved: { project: override, basis: 'override' }, problem: null };
  }
  const linked = projects.filter(
    project => project.linkedBbProjectId === bbProjectId
  );
  if (linked.length === 1) {
    return { resolved: { project: linked[0], basis: 'linked' }, problem: null };
  }
  if (linked.length === 0) {
    return {
      resolved: null,
      problem:
        'No BB Tasks project is linked to this BB project. Link one (bb tasks project create --link-bb-project <proj_id>) or choose a project in Manage.'
    };
  }
  return {
    resolved: null,
    problem:
      'Multiple BB Tasks projects are linked to this BB project; choose one in Manage.'
  };
}

interface AdapterProbe {
  projects: z.infer<typeof tasksProjectSchema>[];
  probeError: string | null;
}

export function createBbTasksAdapter(
  bb: BbPluginApi,
  enabled: boolean,
  bbProjectId: string,
  bbTasksProjectId: string,
  callRpc: BbTasksRpcCaller = defaultCallRpc(bb)
): WorkSourceAdapter {
  const source = 'bbtasks' as const;

  let probe: Promise<AdapterProbe> | null = null;
  function probeProjects(): Promise<AdapterProbe> {
    if (!probe) {
      probe = callRpc({
        pluginId: 'tasks',
        method: 'listProjects',
        input: {},
        outputSchema: listProjectsResponseSchema
      })
        .then(result => ({ projects: result.projects, probeError: null }))
        .catch((error: unknown) => ({
          projects: [],
          probeError: errorMessage(error)
        }));
    }
    return probe;
  }

  let resolution: Promise<BbTasksResolution> | null = null;
  function resolveProjects(): Promise<BbTasksResolution> {
    if (!resolution) {
      resolution = probeProjects().then(({ projects, probeError }) => {
        if (probeError !== null) {
          return { projects: [], resolved: null, problem: null, probeError };
        }
        const { resolved, problem } = resolveTasksProject(
          projects,
          bbProjectId,
          bbTasksProjectId
        );
        return { projects, resolved, problem, probeError: null };
      });
    }
    return resolution;
  }

  function requireTargetProject(): Promise<BbTasksResolvedProject> {
    return resolveProjects().then(result => {
      if (result.resolved === null) {
        throw new Error(result.probeError ?? result.problem ?? PLUGIN_MISSING_MESSAGE);
      }
      return result.resolved;
    });
  }

  function projectSummaries(
    projects: z.infer<typeof tasksProjectSchema>[]
  ): BbTasksProjectSummary[] {
    return projects.map(project => ({
      id: project.id,
      name: project.name,
      prefix: project.prefix,
      linkedBbProjectId: project.linkedBbProjectId
    }));
  }

  async function fetchLabels(
    tasksProjectId: string
  ): Promise<Map<string, string>> {
    const result = await callRpc({
      pluginId: 'tasks',
      method: 'listLabels',
      input: { projectId: tasksProjectId },
      outputSchema: listLabelsResponseSchema
    });
    return new Map(result.labels.map(label => [label.id, label.name]));
  }

  function labelsFor(
    labelNames: Map<string, string>,
    labelIds: string[]
  ): string[] {
    return labelIds
      .map(id => labelNames.get(id))
      .filter((name): name is string => typeof name === 'string');
  }

  function toExternalItem(
    task: z.infer<typeof tasksTaskSchema>,
    labelNames: Map<string, string>,
    tasksProjectName: string | null
  ): ExternalWorkItem {
    return {
      source,
      locator: task.key,
      key: task.key,
      title: task.title,
      description: task.description,
      url: '',
      status: formatTasksStatusName(task.status),
      stateCategory: tasksStateCategory(task.status),
      priority: task.priority,
      assignee: null,
      project: tasksProjectName,
      labels: labelsFor(labelNames, task.labelIds ?? []),
      updatedAt: task.updatedAt
    };
  }

  return {
    source,
    configured: () => enabled,
    configurationMessage: () =>
      enabled ? null : 'Enable BB Tasks in Taskboard settings.',
    async list() {
      const target = await requireTargetProject();
      const labelNames = await fetchLabels(target.project.id);
      const items: ExternalWorkItem[] = [];
      let cursor: string | undefined;
      for (;;) {
        const result = await callRpc({
          pluginId: 'tasks',
          method: 'listTasks',
          input: {
            projectId: target.project.id,
            sort: 'manual',
            limit: TASKS_LIST_PAGE_LIMIT,
            ...(cursor ? { cursor } : {})
          },
          outputSchema: listTasksResponseSchema
        });
        for (const task of result.tasks) {
          items.push(toExternalItem(task, labelNames, target.project.name));
        }
        if (!result.nextCursor || items.length >= TASKS_LIST_TOTAL_LIMIT) {
          break;
        }
        cursor = result.nextCursor;
      }
      return items.slice(0, TASKS_LIST_TOTAL_LIMIT);
    },
    async get(locator: string): Promise<ExternalWorkItemDetail> {
      const target = await requireTargetProject();
      const key = locator.trim();
      if (!isValidTaskKey(key)) {
        throw new Error(`Invalid BB Tasks key: ${key}`);
      }
      const result = await callRpc({
        pluginId: 'tasks',
        method: 'getTaskByKey',
        input: { taskKey: key },
        outputSchema: getTaskResponseSchema
      });
      const task = result.task;
      if (!task) throw new Error(`BB Tasks task not found: ${key}`);
      const [labelNames, commentsResult] = await Promise.all([
        fetchLabels(task.projectId),
        callRpc({
          pluginId: 'tasks',
          method: 'listComments',
          input: { taskId: task.id },
          outputSchema: listCommentsResponseSchema
        })
      ]);
      return {
        ...toExternalItem(task, labelNames, target.project.name),
        comments: commentsResult.comments.map(comment => ({
          author: comment.authorName,
          body: comment.body,
          createdAt: comment.createdAt
        }))
      };
    },
    async statusOptions(locator: string): Promise<ExternalWorkStatusOption[]> {
      const key = locator.trim();
      if (!isValidTaskKey(key)) {
        throw new Error(`Invalid BB Tasks key: ${key}`);
      }
      const result = await callRpc({
        pluginId: 'tasks',
        method: 'getTaskByKey',
        input: { taskKey: key },
        outputSchema: getTaskResponseSchema
      });
      const current = result.task?.status;
      return tasksStatuses.map(status => ({
        id: status,
        name: formatTasksStatusName(status),
        stateCategory: tasksStateCategory(status),
        current: status === current
      }));
    },
    async createMetadata(
      input: ExternalWorkItemCreateMetadataInput
    ): Promise<import('../contract.js').CreateIssueMetadata> {
      void input;
      const target = await requireTargetProject();
      const labelResult = await callRpc({
        pluginId: 'tasks',
        method: 'listLabels',
        input: { projectId: target.project.id },
        outputSchema: listLabelsResponseSchema
      });
      return {
        statusOptions: tasksStatuses.map(status => ({
          id: status,
          label: formatTasksStatusName(status)
        })),
        assigneeOptions: [],
        priorityOptions: tasksPriorities.map(priority => ({
          id: priority,
          label: priority
        })),
        labelOptions: labelResult.labels.map(label => ({
          id: label.id,
          label: label.name
        })),
        milestoneOptions: [],
        issueTypeOptions: [],
        defaultStatusId: 'todo',
        defaultIssueTypeId: null,
        supportsDueDate: true
      };
    },
    async create(
      input: ExternalWorkItemCreateInput
    ): Promise<ExternalWorkItemCreateResult> {
      const result = await callRpc({
        pluginId: 'tasks',
        method: 'createTask',
        input: {
          projectId: input.destinationId,
          title: input.title,
          description: input.description,
          ...(input.statusId ? { status: input.statusId } : {}),
          ...(input.priorityId ? { priority: input.priorityId } : {}),
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          labelIds: input.labelIds
        },
        outputSchema: taskMutationResultSchema
      });
      if (!result.ok) {
        throw new Error(tasksDomainMessage(result.error));
      }
      const labelNames = await fetchLabels(result.task.projectId);
      const target = await requireTargetProject();
      const item = {
        ...toExternalItem(result.task, labelNames, target.project.name),
        comments: []
      };
      return {
        item,
        warnings: [],
        assigneeConfirmation: { confirmed: true, id: null }
      };
    },
    async updateStatus(
      locator: string,
      statusId: string
    ): Promise<ExternalWorkItemDetail> {
      const key = locator.trim();
      if (!isValidTaskKey(key)) {
        throw new Error(`Invalid BB Tasks key: ${key}`);
      }
      const parsed = tasksStatusSchema.safeParse(statusId);
      if (!parsed.success) {
        throw new Error(`Unknown BB Tasks status: ${statusId}`);
      }
      const found = await callRpc({
        pluginId: 'tasks',
        method: 'getTaskByKey',
        input: { taskKey: key },
        outputSchema: getTaskResponseSchema
      });
      const task = found.task;
      if (!task) throw new Error(`BB Tasks task not found: ${key}`);
      const moved = await callRpc({
        pluginId: 'tasks',
        method: 'updateTask',
        input: { taskId: task.id, status: parsed.data, authorName: 'Taskboard' },
        outputSchema: taskMutationResultSchema
      });
      if (!moved.ok) {
        throw new Error(tasksDomainMessage(moved.error));
      }
      const labelNames = await fetchLabels(moved.task.projectId);
      const target = await requireTargetProject();
      return {
        ...toExternalItem(moved.task, labelNames, target.project.name),
        comments: []
      };
    }
  };

}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Server-side helper mirroring loadGithubStatus: resolves the Tasks project
 * list, the configured destination, and a user-facing problem message for the
 * create-issue context. Throws when the Tasks plugin is unreachable.
 */
export async function resolveBbTasksContext(
  bb: BbPluginApi,
  bbProjectId: string,
  bbTasksProjectId: string,
  callRpc: BbTasksRpcCaller = defaultCallRpc(bb)
): Promise<{
  projects: BbTasksProjectSummary[];
  destinationIds: string[];
  destinationLabels: Map<string, string>;
  defaultDestinationId: string | null;
  problem: string | null;
}> {
  const result = await callRpc({
    pluginId: 'tasks',
    method: 'listProjects',
    input: {},
    outputSchema: listProjectsResponseSchema
  });
  const { resolved, problem } = resolveTasksProject(
    result.projects,
    bbProjectId,
    bbTasksProjectId
  );
  const destinationIds = resolved ? [resolved.project.id] : [];
  const destinationLabels = new Map(
    destinationIds.map(id => {
      const project = result.projects.find(entry => entry.id === id);
      return [id, project ? `${project.prefix} — ${project.name}` : id];
    })
  );
  return {
    projects: result.projects.map(project => ({
      id: project.id,
      name: project.name,
      prefix: project.prefix,
      linkedBbProjectId: project.linkedBbProjectId
    })),
    destinationIds,
    destinationLabels,
    defaultDestinationId: destinationIds[0] ?? null,
    problem
  };
}
