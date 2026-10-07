import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      const sourceUrl = new URL(
        `${specifier.slice(0, -'.js'.length)}.ts`,
        context.parentURL
      );
      if (existsSync(fileURLToPath(sourceUrl))) {
        return { shortCircuit: true, url: sourceUrl.href };
      }
    }
    return nextResolve(specifier, context);
  }
});

const {
  createBbTasksAdapter,
  formatTasksStatusName,
  isValidTaskKey,
  resolveTasksProject,
  tasksStateCategory
} = await import('../sources/bb-tasks.ts');
const PROJ = '01HX0000000000000000000001';
const PROD_ID = '01HX000000000000000000000A';
const WEB_ID = '01HX000000000000000000000B';
const TASK_ID = '01HX00000000000000000000A1';
const LABEL_ID = '01HX00000000000000000000B1';

const projects = [
  {
    id: PROD_ID,
    name: 'Product',
    prefix: 'PROD',
    nextTaskNumber: 15,
    folderId: null,
    linkedBbProjectId: 'proj_alpha',
    createdAt: '2026-10-01T00:00:00.000Z'
  },
  {
    id: WEB_ID,
    name: 'Website',
    prefix: 'WEB',
    nextTaskNumber: 4,
    folderId: null,
    linkedBbProjectId: null,
    createdAt: '2026-10-01T00:00:00.000Z'
  }
];

const prodTask = {
  id: TASK_ID,
  projectId: PROD_ID,
  number: 12,
  key: 'PROD-12',
  title: 'Ship task delegation flow',
  description: 'Implement the flow and run focused validation.',
  status: 'in_review',
  priority: 'high',
  dueDate: null,
  parentTaskId: null,
  position: 1,
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-06T10:00:00.000Z',
  labelIds: [LABEL_ID]
};

const labels = [{ id: LABEL_ID, name: 'agents', color: 'blue' }];

function fakeCallRpc(calls: Array<{ method: string; input: unknown }>) {
  return async function callRpc(args: {
    pluginId: string;
    method: string;
    input: unknown;
  }) {
    calls.push({ method: args.method, input: args.input });
    if (args.method === 'listProjects') {
      return { projects };
    }
    if (args.method === 'listTasks') {
      return { tasks: [prodTask], nextCursor: null };
    }
    if (args.method === 'getTaskByKey') {
      return { task: prodTask };
    }
    if (args.method === 'listLabels') {
      return { labels };
    }
    if (args.method === 'listComments') {
      return {
        comments: [
          {
            id: '01HX00000000000000000000C1',
            taskId: TASK_ID,
            kind: 'agent',
            authorName: 'Worker',
            body: 'Started validation.',
            createdAt: '2026-10-06T11:00:00.000Z'
          }
        ]
      };
    }
    if (args.method === 'createTask') {
      return { ok: true, task: prodTask };
    }
    if (args.method === 'updateTask') {
      return { ok: true, task: { ...prodTask, status: 'done' } };
    }
    throw new Error(`unexpected method ${args.method}`);
  };
}

function adapter(calls: Array<{ method: string; input: unknown }> = []) {
  return createBbTasksAdapter(
    {} as never,
    true,
    'proj_alpha',
    '',
    fakeCallRpc(calls) as never
  );
}

test('task status mapping collapses in_review into in_progress', () => {
  assert.equal(tasksStateCategory('backlog'), 'backlog');
  assert.equal(tasksStateCategory('todo'), 'todo');
  assert.equal(tasksStateCategory('in_progress'), 'in_progress');
  assert.equal(tasksStateCategory('in_review'), 'in_progress');
  assert.equal(tasksStateCategory('done'), 'done');
  assert.equal(tasksStateCategory('canceled'), 'canceled');
  assert.equal(formatTasksStatusName('in_review'), 'In Review');
});

test('task keys validate', () => {
  assert.ok(isValidTaskKey('PROD-12'));
  assert.ok(isValidTaskKey('prod-12'));
  assert.equal(isValidTaskKey('PROD12'), false);
  assert.equal(isValidTaskKey('PROD-'), false);
});

test('linked project resolves automatically', () => {
  const { resolved, problem } = resolveTasksProject(projects, 'proj_alpha', '');
  assert.equal(problem, null);
  assert.equal(resolved?.project.id, PROD_ID);
  assert.equal(resolved?.basis, 'linked');
});

test('override by id or prefix wins', () => {
  const byId = resolveTasksProject(projects, 'proj_alpha', WEB_ID);
  assert.equal(byId.resolved?.project.id, WEB_ID);
  assert.equal(byId.resolved?.basis, 'override');
  const byPrefix = resolveTasksProject(projects, 'proj_alpha', 'WEB');
  assert.equal(byPrefix.resolved?.project.id, WEB_ID);
});

test('no linked project reports a problem', () => {
  const { resolved, problem } = resolveTasksProject(projects, 'proj_beta', '');
  assert.equal(resolved, null);
  assert.match(problem ?? '', /No BB Tasks project is linked/);
});

test('unknown override reports a problem', () => {
  const { resolved, problem } = resolveTasksProject(
    projects,
    'proj_alpha',
    '01HX00000000000000000000ZZ'
  );
  assert.equal(resolved, null);
  assert.match(problem ?? '', /was not found/);
});

test('list maps tasks with label names and no URL', async () => {
  const items = await adapter().list();
  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.source, 'bbtasks');
  assert.equal(item.locator, 'PROD-12');
  assert.equal(item.key, 'PROD-12');
  assert.equal(item.status, 'In Review');
  assert.equal(item.stateCategory, 'in_progress');
  assert.equal(item.priority, 'high');
  assert.deepEqual(item.labels, ['agents']);
  assert.equal(item.url, '');
  assert.equal(item.project, 'Product');
});

test('list paginates until the cursor ends', async () => {
  const calls: Array<{ method: string; input: unknown }> = [];
  let secondPage = false;
  const callRpc = async function (args: {
    pluginId: string;
    method: string;
    input: unknown;
  }) {
    calls.push({ method: args.method, input: args.input });
    if (args.method === 'listProjects') return { projects };
    if (args.method === 'listLabels') return { labels };
    if (args.method === 'listTasks') {
      if (!secondPage) {
        secondPage = true;
        return {
          tasks: [prodTask],
          nextCursor: '01HX00000000000000000000CU'
        };
      }
      return { tasks: [prodTask], nextCursor: null };
    }
    throw new Error(`unexpected method ${args.method}`);
  };
  const items = await createBbTasksAdapter(
    {} as never,
    true,
    'proj_alpha',
    '',
    callRpc as never
  ).list();
  assert.equal(items.length, 2);
  const listCalls = calls.filter(call => call.method === 'listTasks');
  assert.equal(listCalls.length, 2);
  assert.deepEqual(
    (listCalls[0].input as { cursor?: string }).cursor ?? undefined,
    undefined
  );
  assert.equal(
    (listCalls[1].input as { cursor?: string }).cursor,
    '01HX00000000000000000000CU'
  );
});

test('get resolves comments and label names', async () => {
  const detail = await adapter().get('PROD-12');
  assert.equal(detail.title, 'Ship task delegation flow');
  assert.deepEqual(detail.labels, ['agents']);
  assert.equal(detail.comments.length, 1);
  assert.equal(detail.comments[0].author, 'Worker');
  assert.equal(detail.comments[0].body, 'Started validation.');
});

test('get rejects malformed keys', async () => {
  await assert.rejects(() => adapter().get('not-a-key'), /Invalid BB Tasks key/);
});

test('statusOptions mark the current status', async () => {
  const options = await adapter().statusOptions('PROD-12');
  assert.equal(options.length, 6);
  const current = options.filter(option => option.current);
  assert.equal(current.length, 1);
  assert.equal(current[0].id, 'in_review');
  const review = options.find(option => option.id === 'in_review');
  assert.equal(review?.stateCategory, 'in_progress');
});

test('createMetadata offers tasks statuses, priorities, labels, due date', async () => {
  const metadata = await adapter().createMetadata({
    destinationId: PROD_ID,
    issueType: null
  });
  assert.deepEqual(
    metadata.statusOptions.map(option => option.id),
    ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled']
  );
  assert.deepEqual(
    metadata.priorityOptions.map(option => option.id),
    ['urgent', 'high', 'medium', 'low', 'none']
  );
  assert.deepEqual(
    metadata.labelOptions.map(option => option.id),
    [LABEL_ID]
  );
  assert.deepEqual(metadata.assigneeOptions, []);
  assert.deepEqual(metadata.milestoneOptions, []);
  assert.deepEqual(metadata.issueTypeOptions, []);
  assert.equal(metadata.defaultStatusId, 'todo');
  assert.equal(metadata.supportsDueDate, true);
});

test('create calls createTask and returns the task without assignee', async () => {
  const calls: Array<{ method: string; input: unknown }> = [];
  const result = await adapter(calls).create({
    title: 'Polish sync errors',
    description: 'Show per-source sync errors.',
    destinationId: PROD_ID,
    issueType: null,
    statusId: 'todo',
    assigneeId: null,
    priorityId: 'high',
    labelIds: [LABEL_ID],
    dueDate: '2026-10-12',
    milestoneId: null
  });
  const createCall = calls.find(call => call.method === 'createTask');
  assert.ok(createCall);
  const input = createCall.input as {
    projectId: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
  };
  assert.equal(input.projectId, PROD_ID);
  assert.equal(input.title, 'Polish sync errors');
  assert.equal(input.status, 'todo');
  assert.equal(input.priority, 'high');
  assert.equal(input.dueDate, '2026-10-12');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.assigneeConfirmation, { confirmed: true, id: null });
  assert.equal(result.item.key, 'PROD-12');
  assert.deepEqual(result.item.comments, []);
});

test('create unwraps ok:false into a thrown error', async () => {
  const callRpc = async function (args: {
    pluginId: string;
    method: string;
    input: unknown;
  }) {
    if (args.method === 'createTask') {
      return {
        ok: false,
        error: { code: 'prefix_exists', message: 'Prefix already exists' }
      };
    }
    throw new Error(`unexpected method ${args.method}`);
  };
  const source = createBbTasksAdapter(
    {} as never,
    true,
    'proj_alpha',
    '',
    callRpc as never
  );
  await assert.rejects(
    () =>
      source.create({
        title: 'Broken',
        description: '',
        destinationId: PROD_ID,
        issueType: null,
        statusId: null,
        assigneeId: null,
        priorityId: null,
        labelIds: [],
        dueDate: null,
        milestoneId: null
      }),
    /Prefix already exists/
  );
});

test('updateStatus routes through updateTask with the Taskboard author', async () => {
  const calls: Array<{ method: string; input: unknown }> = [];
  const detail = await adapter(calls).updateStatus('PROD-12', 'done');
  const updateCall = calls.find(call => call.method === 'updateTask');
  assert.ok(updateCall);
  const input = updateCall.input as { taskId: string; status: string; authorName: string };
  assert.equal(input.taskId, TASK_ID);
  assert.equal(input.status, 'done');
  assert.equal(input.authorName, 'Taskboard');
  assert.equal(detail.status, 'Done');
  assert.equal(detail.stateCategory, 'done');
});

test('updateStatus rejects unknown statuses', async () => {
  await assert.rejects(
    () => adapter().updateStatus('PROD-12', 'deployed'),
    /Unknown BB Tasks status/
  );
});

test('plugin-unavailable probe fails gracefully', async () => {
  const callRpc = async function () {
    throw new Error('Tasks plugin is not installed');
  };
  const source = createBbTasksAdapter(
    {} as never,
    true,
    'proj_alpha',
    '',
    callRpc as never
  );
  assert.equal(source.configured(), true);
  await assert.rejects(
    () => source.list(),
    /Tasks plugin is not installed/
  );
});

test('disabled adapter reports unconfigured', () => {
  const source = createBbTasksAdapter(
    {} as never,
    false,
    'proj_alpha',
    '',
    fakeCallRpc([]) as never
  );
  assert.equal(source.configured(), false);
  assert.match(source.configurationMessage() ?? '', /Enable BB Tasks/);
});
