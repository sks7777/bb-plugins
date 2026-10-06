# BB Tasks как источник в Taskboard (наравне с GitHub/GitLab/Linear/Jira)

## Контекст (результат исследования)

- `plugins/taskboard`: каждый BB-проект выбирает **один** трекер. Единая точка правды —
  `workSourceSchema = z.enum(['linear','github','jira','gitlab'])` в `contract.ts`; TS-типы
  распространяют значение дальше (`SOURCES` в server.ts, `Record<WorkSource,…>` снапшоты).
- Интерфейс адаптера: `WorkSourceAdapter` в `sources/types.ts`
  (`configured, configurationMessage, list, get, statusOptions, createMetadata, create, updateStatus`).
- **Прецедент межплагинного доступа уже есть**: GitHub-адаптер ходит в официальный `github`
  плагин через `bb.sdk.plugins.callRpc({pluginId, method, input, outputSchema})`
  (POST `/api/v1/plugins/<id>/rpc/<method>`), локально переобъявляя zod-схемы ответа.
  Discovery не требуется. Тот же паттерн — для tasks.
- Официальный **Tasks-плагин** (`bb plugin install tasks`, категория tasks-and-workflows)
  регистрирует RPC `tasksRpcContract`: `listProjects` (с `linkedBbProjectId`),
  `listTasks` (фильтры, sort, limit≤500 + cursor), `getTaskByKey` (prefix регистронезависим,
  поддерживает алиасы ключей после move), `listComments`, `listLabels`, `updateTask`,
  `createTask`, `boardMove`. Мутации публикуют realtime `tasks:changed`/`comments:changed` —
  приложение Tasks обновляется само.
- Фиксированные статусы: `backlog, todo, in_progress, in_review, done, canceled`;
  приоритеты: `urgent, high, medium, low, none`. Assignee/milestone/issueType/внешний URL — нет.
- Персист taskboard — SQLite (`store.ts`): CHECK `source IN (…)` в `work_items_by_project`,
  `source_sync_by_project`, `project_source_config`. Паттерн расширения — миграция-recreation
  (так добавляли gitlab). Глобальные таблицы `work_items`/`source_sync` давно удалены.
- CLI `bb taskboard` использует литеральные списки источников в usage-строках.
- `sourceName()` в `contract.ts` и `app.tsx` имеет скрытый fallback `return 'Linear'` — при
  добавлении источника нужно явное ветвление.

**Ключевое архитектурное решение**: адаптер BB Tasks через `bb.sdk.plugins.callRpc(pluginId:'tasks')`,
не через `bb tasks` CLI (CLI-хост — отдельный процесс; RPC — in-process HTTP, как у GitHub).

## Маппинг BB Tasks → WorkSourceAdapter

- `locator` = ключ задачи (`PROD-12`). `get` = `getTaskByKey` + `listComments` + `listLabels`
  (labelIds → имена; лейблы проекта кэшировать в инстансе адаптера).
- `statusOptions` — 6 фиксированных; stateCategory: backlog→backlog, todo→todo,
  in_progress→in_progress, **in_review→in_progress**, done→done, canceled→canceled; `current` из task.status.
- `updateStatus` = `updateTask {taskId, status, authorName:'Taskboard'}` (нейтрально; без
  boardMove-комментария и позиционирования).
- Destination создания = tasks-проект: `destinationId` = ULID tasks-проекта; по умолчанию
  проект со `linkedBbProjectId === bbProjectId`, иначе явный выбор в Manage
  (новое поле конфига `bbTasksProjectId`, `''` = авто-линк). `destinationLabel: 'Tasks project'`.
- `create` = `createTask {projectId, title, description, status, priority, dueDate, labelIds}`;
  `assigneeConfirmation: {confirmed:true, id:null}`, warnings `[]`.
- `url` = `''` (внешней ссылки нет): скрыть кнопку Open в детальном виде при пустом url;
  `formatWorkItemContext` печатает `(BB Tasks task)` вместо пустого URL.
- `assignee` = null; `project` = имя tasks-проекта; `priority` = enum-строка как есть.
- `configured()` = memoized проба `listProjects` через callRpc; tasks не установлен/выключен →
  `configurationMessage`: «Install and enable the BB Tasks plugin (bb plugin install tasks)».
- Пагинация `listTasks`: страницы по 500 до `nextCursor === null` (потолок ~2000).

## Шаги

1. **contract.ts**: `'bbtasks'` в `workSourceSchema`; `bbTasksProjectId` (string, `''`=авто) в
   `projectSourceConfigSchema` (мутация наследует автоматически); `bbTasksProjects: [{id, name,
   prefix, linkedBbProjectId}]` в `projectConfigViewSchema`; `'Tasks project'` в
   `destinationLabel` enum; `sourceName()`: bbtasks → `'BB Tasks'`.
2. **sources/bb-tasks.ts** (новый): локальные zod-схемы RPC (ULID-id, task/project/comment/label
   схемы, discriminated-union mutation result), экспортируемые маппер-функции (для тестов),
   `createBbTasksAdapter(bb, opts)` с инъекцией `callRpc` для тестов.
3. **store.ts**: новая миграция — recreation трёх таблиц с CHECK `+ 'bbtasks'` и новой колонкой
   `bb_tasks_project_id TEXT NOT NULL DEFAULT ''` в `project_source_config`; обновить
   rowToConfig / saveProjectConfig / DEFAULT columns; пересоздать индексы как в прошлых миграциях.
4. **server.ts**: `SOURCES` += `'bbtasks'`; `DEFAULT_PROJECT_CONFIG.bbTasksProjectId = ''`;
   ветка `adapters()` → `createBbTasksAdapter`; `getCreateIssueContext`: label `'Tasks project'`,
   destinations из tasks-проектов (linked первым, иначе выбранный), missingDestination-сообщение;
   `changedSources`/`sameProjectConfig` учитывают `bbTasksProjectId`; `revisionSnapshot` —
   компилятор укажет места.
5. **CLI `bb taskboard`**: usage-строки всех команд + `bbtasks`; `config --bb-tasks-project
   <prefix|id>` (парсинг, валидация, персист).
6. **app.tsx**: `SOURCE_FILTER_OPTIONS`, `TRACKER_OPTIONS` (description «BB Tasks projects»),
   `isWorkSource`, `sourceName`, `SourceGlyph` (готовая Icon, напр. ListChecks — бренд-SVG не нужен);
   Manage: при source='bbtasks' селект tasks-проекта (по умолчанию «Linked project»); скрыть
   Open при пустом url; проверить, что поля assignee/milestone/issueType создания скрываются
   при пустых списках метаданных.
7. **Тесты**: `contract.test.ts` (enum, destinationLabel); новый `test/sources-bb-tasks.test.ts`
   (мапперы статусов/локаторов/ключей + адаптер с фейковым callRpc: list, get, create,
   updateStatus, ошибки, пагинация); прогнать `app-ui.test.ts`, поправить при необходимости.
8. **Доки/версия**: README плагина — раздел BB Tasks (установка tasks, связывание, статусы,
   «без токенов и креденшелов»); корневой README-каталог; bump 0.3.3 → 0.4.0; keywords.
9. **Empirical (перед мутациями)**: `.empirical/config.json` валиден (schemaVersion 5);
   работа = UI + миграция + cross-plugin → `empirical_complex`; worktree-предложение показать
   и ждать одобрения (isolation.mode = ask).
10. **Верификация**: `npm install && npm run check` из корня; `bb plugin install
    ./plugins/taskboard && bb plugin reload taskboard`; ручной прогон: Manage → BB Tasks →
    борд, создание, перенос статуса, проверка живого обновления в приложении Tasks; edge cases:
    tasks не установлен, нет связанного tasks-проекта, >500 задач (пагинация), задача переехала
    между projects (алиас ключей резолвится), статус из Tasks → обновление в taskboard после sync.
11. **Commit → local-review → правки → commit → PR**:
    - commit изменений в ветке фичи (conventional summary, например
      `feat(taskboard): add BB Tasks as a tracker source`);
    - вызвать сабагента с промптом `/local-review main` (по базе `main`; гайданс —
      «new source adapter + SQLite CHECK migration + UI source wiring»);
    - сразу применить находки ревью (правки + тесты), прогнать `npm run check` ещё раз;
    - commit правок;
    - открыть PR в `main` через `gh pr create` (заголовок и описание из коммитов,
      раздел про миграцию и требование Tasks-плагина в описании). Это же закрывает
      evidence.codeReview из `.empirical/config.json` (complex-профиль).

## Риски

- Даунгрейд плагина после появления `bbtasks`-строк в кэше уронит старую миграцию-recreation на
  CHECK — тот же класс риска, что и при добавлении gitlab; осознанно принимаем.
- Внешние системные зависимости: tasks-плагин может быть не установлен/выключен — состояние
  показывается штатно через `configurationMessage`/`sync.error`.
- `in_review` маппится в `in_progress` (категория taskboard не различает) — как у Linear.
- Порядок статусов в Manage (statusOrder) строится из id статус-опций адаптера — проверить,
  что дефолтный порядок совпадает с порядком `statusOptions`.

## Открытые вопросы (решения по умолчанию, нужны подтверждения)

1. ID источника: `'bbtasks'` (рекомендую; попадает в БД, CLI, упоминания).
2. Полнота записи: создание задач + перенос статусов (рекомендую полную паритетность).
3. Пустой URL: скрывать кнопку Open (рекомендую; глубоких ссылок на панель Tasks нет).
