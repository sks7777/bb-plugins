---
name: empirical
description: Use only when the user explicitly invokes empirical, asks to use Empirical for this task, or continues the same opted-in task. Do not use for unrelated ordinary coding requests, read-only explanation or inspection, or when the user opts out.
disable-model-invocation: true
---

<!-- empirical-sdd:managed-file -->
# Empirical

## Direct mode

Go direct when the user says "direct", "without Empirical", "quick change" or "go direct", or when no
explicit Empirical, Fast or Complex request and no selected feature exist and `defaultMode` is `direct` —
personal `<git-dir>/empirical-sdd/preferences.json` first, else team `.empirical/config.json`.
A selected feature continues in Empirical until the user says "go direct".
Direct work needs nothing else from this skill. Make no Empirical call: no spec, state, journal event,
decision, receipt, tracker update or worktree proposal, and no loop, next, status, explain or context call.
Read no `.empirical/specs/**`, decisions, capabilities or context pages unless the user asks. The newest
request outranks earlier specifications and Accepted decisions; do not report that as a conflict.
Run no test, lint, typecheck or build unless the user asks; then run exactly that command (for a generic
"run the tests", the repository's own test script) once through the shell — no `empirical_qa_execute`, no
receipt, no matrix, no repair loop.
Never merge, tag, publish, use credentials or run destructive Git without an explicit request; push
and open pull requests only as Ship early below allows.
Call `empirical_direct` only for "go direct" (`pause`), "back to Empirical" (`resume`) and "track this"
(`track`, or `resume` while the feature is paused); pause and resume take the exact revision.
End a turn that changed files with `Changed <X> in <N> files · not tested (not requested) · say "track this" to formalize`,
replacing the middle segment with `ran <command>: passed` or `ran <command>: failed` when a check was
requested; when nothing changed, no such line appears.

## Ship early

Open a draft pull request at the first coherent commit of feature work, then push every commit.
Commits and pushes never wait on test runs: run requested or required tests for the change in the
background, keep working and fold their results into later commits. Heavy or full-suite runs belong to pull-request CI; run them
locally only with explicit approval. This push authority covers only the agent's own feature branch and
draft pull requests: never merge, never push to a protected or target branch, never force push. When the
repository has no remote or `gh` is unavailable, say so and continue locally.

## Empirical workflow

Use Empirical only for work the user chooses to run through it.

Explain unfamiliar warnings with docs/harness-guide.md and link the roadmap's help
when present. Configuration choices and fixed rules are in docs/configuration.md;
users can run `empirical doctor --options` directly. A pending feature never
blocks independent work in another checkout, commits, or an authorized draft PR.
When the roadmap says fresh-context acceptance is covered by review, do not ask
for another human QA record: no extra execution is required. UI outcome checks
and stale reviews still need their own evidence. Use the plan's affected tests
and carry valid checks forward. For completion or closure, pass `decisionBy`
only when the user has supplied that identity; never infer it from the agent actor.


1. Before any Empirical operation, honor a request to work without Empirical as
   Direct mode above: continue ordinary work without starting or resuming
   workflow state. Otherwise,
   read `.empirical/config.json`. Automatic routing requires valid
   `schemaVersion: 5`, `setupComplete: true` and
   `activationMode: "automatic"`. Missing activationMode means explicit-only.
   In explicit mode, proceed only when the user explicitly invokes this skill
   or asks to use Empirical for this task; generic requests to fix, implement or
   continue work do not opt in. Read-only explanation and inspection stay outside
   the workflow. Installation, an existing feature or previous use alone is not
   consent. If the user has already chosen Empirical for the current task,
   continue that task without asking again unless they opt out.
   That task-level choice survives a repository-root, checkout, worktree, or
   host-environment change. Before the first source or repository write after
   such a transition, rediscover the destination project and reload its exact
   action, then read the returned tracker health, enforcement and gate. A
   destination with explicit activation, or a host that does not relist the
   local skill, does not opt the active task out. If the destination has no
   matching feature, start or transfer the same authorized task there before
   editing; never continue as untracked ordinary work. A blocked strict gate
   permits only its exact tracker recovery until a fresh action opens it.
   If config is missing, invalid or incomplete, do not initialize or create
   feature state. Continue ordinary work; suggest invoking `empirical-init`
   explicitly only when the user requested Empirical.
2. After step 1 permits workflow execution, if selected non-terminal work exists, call `empirical_loop` with no request or
   profile and resume the returned action. Attached text never replaces active
   work. The private fallback is `empirical __internal loop`.
   Multiple unclaimed specs are valid inactive work, not abandoned work. If a
   feature-required call returns a structured choice, obtain an explicit id and
   call `empirical_select` (private fallback: `select --id <feature>`).
   Explicit new starts and repository init, integrations, and context do not
   require choosing unrelated specs. Never move specs to resolve ambiguity.
   Unrelated malformed specs or claims belong in overview/Doctor diagnostics;
   do not select or repair them as a prerequisite for an independent start.
   Use `empirical_overview` for a read-only inventory of preserved specs and
   worktree ownership. Selecting an unclaimed spec and transferring a live
   owner's spec are different operations: use `empirical_transfer` only for
   an explicit transfer bound to the source root and exact revision, after the
   destination has the same validated history, then run
   `empirical_worktree_prepare` in the destination. Preserve original
   capability bases and receipts; never copy Git metadata to simulate ownership.
   At every permitted workflow start or resume, call `empirical_status` first
   for the current checkout, then call `empirical_overview` for the global
   repository view. Render both results as Markdown tables in this order:
   **Current SDD** first (branch, feature, profile, phase, revision, status,
   readiness and next action), then **Global SDD** (feature, owner/worktree,
   branch, phase, status and next action for each active selected worktree).
   Do not count every `specs[].copies[]` entry as active work: preserved
   historical copies belong in a separate summary row labeled
   `historical/preserved`, never in the active feature rows. Keep the current
   checkout table even when it is idle, and keep the global table even when it
   has no active entries; write `none` in empty cells. Do not select, mutate
   or repair work while collecting these read-only tables.
   Read `interaction.questions` from every returned action. Report with the
   Empirical status card, built only from the returned `roadmap`, using exactly
   these lines in order: the header
   `Empirical · <feature> · <profile> · <phase> (<index>/<total>) · rev <n>`,
   `Done:` (phases already done), `Not done:` (the current phase's needs and
   each unpassed check with its state), `Next:` (`roadmap.nextAction`),
   `Waiting on you:` (one `[kind] text` line per `waitingOn` item), and
   `Verification:` (`<remaining> of <total> checks left` with the known
   estimate and how many are unknown), then `Time:` (`<elapsed> of <budget>
   budget`, marked over budget) when `roadmap.time` is present. Write `none`
   for an empty section. Also show `Regression:` for the newest `roadmap.jobs` entry (status, job, check, estimate, receipt or failing file count). When `roadmap.time.over` is true or a `waitingOn`
   decision names a checkpoint, stop at the checkpoint: show the card with the
   exits (ship as is with a draft PR, split, defer non-blocking findings,
   continue with a new budget, or stop) and wait. Never continue past an
   exceeded budget without the user's choice; record continue only through
   `empirical_checkpoint` with the user's minutes and the exact revision. Show
   the card at start or resume, at every phase change, at every stop (Done,
   Blocked, Awaiting Human, or pending verification), and before any run whose
   summed `estimateMs` is over 60 seconds or unknown; in that last case state
   the estimate and offer to defer the run. Put blockers in `Waiting on you`
   items, never in paragraphs of prose. The card reports facts and authorizes
   nothing: it never grants permission to run tests, push, merge or publish.
   In concise mode add only the exact instruction, compact tracker state and the
   completion action, and ask at most the exact material blocking question;
   detailed mode keeps the expanded context.
3. For a genuinely vague new idea, call `empirical_explore` for repository and
   capability context, then call `empirical_discovery` with empty answers to
   create the draft and receive its first nextQuestion. Ask only the returned
   pass or material follow-up, one at a time, and resubmit the ordered answers
   after each response. The five passes are problem/user, observable outcome,
   boundaries/non-goals, risk/failure, and verification. Show the returned exact
   refined contract and wait for approval before calling `empirical_discovery`
   with approved true.
   Private fallbacks are `empirical __internal explore` and
   `empirical __internal discovery --input <json-file>`.
4. Call `empirical_route` for a concrete Empirical request. Honor its public
   route independently from the compatibility profile: Flow Direct performs
   understood, tightly scoped work without workflow artifacts; Flow Delegated
   uses bounded native delegation and writes at most one concise Flow Record
   only when recovery is useful; Formal SDD starts only when explicitly
   requested or approved and preserves every requested phase. A request not to
   use SDD must never start Formal SDD, and explicit delegated work must really
   delegate. Then choose the compatibility lane when durable workflow state is
   required. Honor explicit Complex. Fast is for small,
   self-contained changes, including behavioral and UI changes. Work that builds
   on an existing foundation and will be integrated uses Complex iterative:
   `empirical_complex` with `iterative: true`, then `empirical_iterate` for
   each adjustment without test runs, then "ready to close" runs final
   verification once. Call `empirical_fast` with the actual request; never
   relabel behavioral work as contract-neutral to obtain Fast. Sensitive,
   migration and publication safety floors still require Complex; integration or
   delivery wording alone does not change an explicit Fast request, and routing
   never grants push, merge or publication authority. For other concrete work,
   call `empirical_complex`.
   For a Complex iterative feature, finish definition, design and planning,
   implement a usable version, then complete once and return control while its
   lifecycle awaits feedback. For an explicitly requested adjustment, call
   `empirical_iterate` with the exact revision and adjustment request; it runs
   no tests. The Implement packet carries a bounded `contractSummary`; its
   spec, design, decisions and plan references are optional. The newest request
   overrides conflicting earlier criteria and decisions: implement it, then
   update the affected criteria and record a superseding decision. Behavior
   changes at the same risk floor amend the contract in place by default
   (`amendContract: true` is the explicit form); the approved contract is kept
   as a baseline snapshot and the amendment is re-approved when the revision
   completes. A feature not started as iterative keeps its approved contract
   strict: `amendContract` is refused there with
   `CONTRACT_AMENDMENT_UNAVAILABLE`. Use `reviseContract: true` when the
   change raises the risk floor or changes the declared capability scope: the
   previous contract is retained and the same feature returns to
   Specify/Design/Plan. Keep unrelated work separate. When the user says
   "ready to close", call
   `empirical_consolidate`. Consolidation itself runs no tests
   and authorizes none; "ready to close" is the explicit request to verify, so
   follow the returned phase order: new Complex work reviews first, then
   run the Verify selection once with `verificationProfile: "final"` and prepare local finalization;
   saved features keep their recorded order; it never runs or approves the full suite, and remote delivery
   still needs its own authorization. Never consolidate automatically because an iteration passed.
   New Fast work has no mandatory test authoring, test execution, formal review
   or Context phase: implement, complete the exact revision, and report
   implemented with verification skipped. For a follow-up adjustment to the same
   Fast feature, call `empirical_iterate` with the exact revision (and the
   feature `id` once it is Done); the counter increments, no tests run, and the
   next completion is again implemented and unverified. A failed Fast
   completion blocks the same Fast feature; recover with `empirical_retry` or an
   explicit `empirical_promote`, or step 12 when the gate cannot be satisfied
   at all. Promotion is explicit only: Fast
   consolidate, Integrate and Deliver require `empirical_promote`, and nothing
   else changes a Fast feature to Complex. Run tests only when the user asks.
   A retained contract describes required proof, not permission to run tests. If
   it conflicts with an explicit no-tests request, report that mismatch; never
   silently run tests or present missing proof as verified. If more process
   becomes necessary, call `empirical_promote` with the same feature, exact
   revision and reason; continue its Complex action without replacing its
   history. Private fallbacks are `empirical __internal fast`, `complex`,
   `iterate` and `promote`; these are agent operations, not user commands.
5. When the user explicitly requests autonomous progress, call `empirical_yolo`
   with the exact request and a bounded implemented, verified, integrated, or
   delivered ceiling. Default to integrated only when no lower ceiling is
   requested. An explicit Fast YOLO (`profile: "fast"`) is limited to
   implemented; request promotion explicitly before any higher ceiling. YOLO
   never authorizes publication and never weakens host, Git, credential,
   evidence, deletion, or branch-protection safety. Its private fallback is
   `empirical __internal yolo`.
6. Show any worktree proposal exactly and obtain approval before calling the
   approved creation operation; reuse approval already given for that exact
   proposal. Creation from the approved committed base can leave the source
   checkout dirty. Never stash, move its edits, force, or replace selected work.
   If approved creation is interrupted, retry its exact original input to finish
   the recorded handoff; do not create a duplicate worktree or branch.
   For an existing implementation request, once that exact proposal is approved
   and creation returns a handoff, the
   approval is sufficient to enter its path and resume its returned action;
   continue without asking for another confirmation or "go" message. If the
   host directory switch ends the turn, do not switch before doing the approved
   work unless the host provides a supported automatic continuation. Continue
   now with shell commands scoped to the handoff path, absolute file paths, and
   that path as the root of every Empirical call; the thread's default cwd need
   not change. Defer the thread directory switch until the approved work reaches
   its requested stopping point. If a switch is required and automatic continuation
   is supported, preserve the request, approval, target path and returned action
   before switching, then resume without user input. Never assume ending a turn
   schedules another one. Worktree creation alone does not complete an approved
   implementation request; execute the returned action and continue the workflow
   within the user's scope. If the user requested only worktree creation, stop
   after creation. Existing independent approval gates still apply.
   Commit the new
   journal state before the tracker sync required below.
   A worktree proposal lists every local file it will copy, marked explicit or
   discovered, and every refused path; approving the proposal approves exactly those
   copies, so pass its `localFiles` unchanged to `empirical_worktree_create`. Create
   worktrees for Empirical work through that proposal. Call
   `empirical_worktree_prepare` when you work in a worktree created by a host tool (such
   as `EnterWorktree` or sub-agent worktree isolation) or by `git worktree add`, before a
   writable delegated worker starts in its registered worktree (set `target` to the
   worker root), after `empirical_transfer` into a destination worktree, and when a
   handoff reports `unapproved` paths (use its source and target). Call it first without
   `approvalToken` to preview, show the listed paths, then call it again with the
   returned `approvalToken` and `approved: true` in the same turn without asking for
   another confirmation; repository configuration is standing consent. Host-created
   worktrees are not provisioned automatically. Never copy, read, print or summarize
   local environment file contents yourself; report only paths and outcomes.
   Stay current with the target branch: when the roadmap reports the branch
   behind its target, at every checkpoint (Implement completion and before
   Integrate or Deliver), and before opening or updating a pull request, call
   `empirical_sync_target` with `fetch: true`. It merges the target (never rebase
   or force) only when the worktree is clean and no conflict is predicted; push
   that merge commit with a normal push. When it refuses with conflicts, report
   the conflicting file names to the user immediately, merge and resolve them,
   then re-run only the tests for the conflicted files.
7. Treat Empirical's local journal as authoritative. If .empirical/tracker.json
   is absent or ticket behavior is off, remain local-only/off and make no
   provider requests. In manual mode use `empirical_tracker_bind` only for the
   user's explicit create or attach choice and never replace a binding
   implicitly. When tracker status includes `changeType` and
   `ticketRequirement`, follow that resolved rule. Required work validates a
   referenced ticket, reconciles the stable feature marker, or creates exactly
   once when no unique ticket exists. Optional work with one reference attaches
   it; optional work with no reference stays local with no credential/provider
   access and MUST NOT trigger a question about creating a ticket. Off work
   makes no provider request. Multiple references are a real ambiguity and
   require an exact choice; Empirical never guesses.
   Core actions synchronize Policy v2 after each durable workflow commit;
   resume retries this checkout's known pending completed tickets. Read returned
   tracker health and enforcement rather than adding a separate sync decision
   after every action. Before a Linear credential operation, check authenticated sibling
   Linear MCP tools using the shared host-discovery procedure below. Prefer
   that connection even when a legacy API-key policy
   exists: call the MCP prepare operation to obtain its migration candidate,
   discover and preview through MCP, then configure the candidate preserving
   target, states, ticket rules and enforcement. Policy v1 maps to manual
   tickets, milestone comments and best-effort enforcement. Never request an
   API key before checking MCP access. Refresh stale managed skills with
   empirical_integrations; package upgrades alone do not rewrite repository files.
   For Linear Policy v2 with `connection: "linear-mcp"`, use the prepared
   `tracker.intent` returned with the action when present. Call
   `empirical_tracker_linear_mcp_prepare` only when no intent is available,
   with the exact feature id, and execute
   only its returned `linear.*` operation via the discovered equivalent host
   tool/schema, submit the bounded normalized
   result through `empirical_tracker_linear_mcp_accept`, and repeat until
   synced. For issue results, copy attachment URLs from Linear get_issue into
   attachmentUrls. For reconciliation (`find-issues`), fetch exactly one
   listing page per intent with its `cursor` argument, including archived
   issues, hydrate each issue on the page with get_issue, and submit the page
   with the listing's `nextCursor` (null on the last page); the next intent
   carries the following cursor. Never report a page as the last one while
   pagination or attachment hydration is incomplete.
   Recovery identities live in issue attachment metadata, not descriptions.
   Other Policy v2 actions synchronize automatically; use
   `empirical_tracker_sync` with the action's exact feature id for explicit recovery.
   A required ticket blocks workflow mutation regardless of whether policy
   enforcement says strict or best-effort. Best-effort is non-blocking only for
   work whose resolved ticket rule is optional. Turning tracking off never clears
   an existing required-ticket obligation. The only bypass is an explicit
   `empirical_tracker_waive` for the selected or terminal feature, recorded
   only when the user says it is tracked elsewhere or abandoned, with their
   reason and justification. A terminal feature cannot be selected; attach its
   existing ticket with `empirical_tracker_bind` and the exact `feature`
   (link-only), or record that explicit waiver.
   V1 retains explicit synchronization. Record confirmed external release or
   deployment observations with `empirical_tracker_record`, using an exact
   source receipt or configured observer and explicit affected features. Never
   infer success from an attempted command. Tracking publishes only configured milestone comments
   and receipt-approved safe evidence, preserves user-authored descriptions,
   and retries durable unacknowledged effects. Read effective `enforcement` and
   `gate` from every action. When a required-ticket gate is blocked, stop all
   source edits, evidence, handoff, and phase work; later mutation prompts may
   only report/retry the exact tracker recovery until a fresh action shows the
   gate open. Best-effort remote failure leaves local progress intact. Report
   local-only, off, synced, pending, or failed health truthfully.
   Tracker operations are granular MCP tools, not additional skills or user
   commands. OAuth authorization is out-of-band through negotiated URL mode.
   Raw credentials are never chat text or tool arguments/results. If OAuth is
   unavailable, host discovery/recovery has been checked, and the user explicitly
   chooses host-file credentials, tell the human `Never paste credentials into chat` and pause
   for direct host-file configuration at
   `${XDG_CONFIG_HOME:-$HOME/.config}/empirical/secrets.env` on POSIX or
   `%APPDATA%\Empirical\secrets.env` on Windows.
8. Tests are on demand in both Fast and Complex. Do not run tests automatically
   while editing, after a modification, or just because a matrix or Verify action
   is returned. Test runs never block a commit or push; follow Ship early above. Use `empirical_qa_plan` to inspect requirements without execution.
   While iterating, run nothing unless the user asks. Map a request to an
   explicit `verificationProfile`: "run the changed tests" or "run the affected
   tests" is `iterate`, run once per request through `empirical_qa_execute`;
   it executes only commands configured with `testFiles: "changed"` and refuses
   to run when no test file matches. "now run it", "run everything" or "ready to
   close" is `final`, which runs only the plan's Verify `selection`: one
   cheapest command per Verify check, named by the roadmap `nextAction`. Run a
   command outside the selection only when the user explicitly asks for it. Fast
   optional checks pass the profile too, plus the feature `id` once it is Done; Fast `final` never runs full CI and its
   receipts never make Fast verified. A test request authorizes that
   run only, not automatic reruns after later edits, and no phase, loop,
   iterate, consolidate, complete or promote runs tests by itself. Never substitute full CI or a
   repository-wide suite for missing focused coverage; report the gap and obtain
   a bounded command configuration. Do not assume a command named "unit" is scoped.
   The full suite runs only as pull-request CI or as a local run the user
   approved; Verify and consolidation never list or run it. The roadmap's full-CI
   check names its promotion route. An omitted `promotion.fullCi` is `auto`:
   on route `ci` (pinned required checks, delivery authorized, no local-forcing reason) never propose
   a local full-suite run, because app-pinned GitHub required check runs on the
   exact head prove it at Deliver after the source pull request is opened and
   before any merge. On route `local`, before a local full-suite run show the
   status card with the command, estimate, revision and route reason, and ask.
   Call `empirical_qa_approve` only after the user's explicit yes in this
   conversation; never approve on the user's behalf, and never treat a test
   request, consolidation or delivery authorization as approval. With the CLI,
   pass `--yes` to `qa-approve` only after that explicit yes in chat, and never
   after a declined form. Each approval authorizes one run, and its marker
   (`elicited`, `agent-relayed`, `cli` or `cli-unattended`) stays visible. The only
   exception is Publish: pass its explicit publication authorization to
   `empirical_qa_execute` as `publicationAuthorization`, which approves
   Publish's own full-CI run without a second prompt.
   Prefer CI for the full regression. When the work is finished, the full
   regression is still needed and CI is not available, ask the user once for
   approval, showing the exact command and its estimate; never start a full
   regression without the user's yes and never run it in the foreground. After recording that approval,
   start it with `empirical_qa_start` and `userApproved: true`, then keep
   working: open or update the draft pull request instead of waiting. Check
   `empirical_qa_status` at natural checkpoints (before reporting, before
   asking for review), never by polling in a loop; a running job is an
   informational `Waiting on you` item and never replaces the next action.
   Report the result when it finishes. On failure, rerun only the failing tests:
   pass the job's `failingTestFiles` as `testFiles` to
   `empirical_qa_start` with a command configured with
   `testFiles: "changed"`; if no failing files were extracted, report the log
   tail instead of rerunning the full suite. A timed-out command is a
   failed attempt, never a dead end: when a check times out (a `Waiting on
   you` decision names it), never rerun the same command in the foreground.
   Offer the user these exits and wait for the choice: run it in the background
   with `empirical_qa_start` and keep working; run a smaller configured
   command that covers the check (Verify needs one command per check, not the
   full suite); hand the full suite to pull-request CI; raise that command's
   `timeoutMs` in the policy up to the stated maximum (this changes the policy,
   so earlier receipts need a new run); or stop, or ship as is with a draft
   pull request (the checkpoint exits). Before starting any run whose estimate
   is near its command timeout or longer than ten minutes, offer the background
   run first. One exact full-CI
   receipt recorded at Integrate carries over to Deliver when commit, tree, spec,
   policy, command and runtime are identical, so Deliver does not rerun it.
   Explicit `promotion.fullCi: "remote-checks"` also accepts remote proof at
   Integrate (only for a commit already pushed) and never falls back to local.
   Remote proof grants no push, merge or publish authority, and Publish always
   needs its own local exact full-CI receipt.
   Honor explicit skip/no-tests requests; if a required gate conflicts, report the
   exact unmet gate without executing tests or weakening its evidence policy.
   Until tests are requested, keep Complex verification pending, preserve the
   current revision for iteration, and return control to the user without asking
   after every edit. Fast may complete implemented and unverified. Never complete
   a required evidence gate with unrun tests or fabricate a passing/skipped receipt.
   On requested verification, execute applicable checks or record only an explicit
   applicable human step with `empirical_qa_record`; keep retries/skips/missing
   environments visible. Review evidence remains independent.
   Use ordinary executed or collected receipts for compatible focused, browser,
   screenshot, and independent review evidence. Complete the exact revision with
   receipt ids and consume the response as the next action. Under the default
   standard binding, a verified feature in Integrate only waits for its merge:
   commit and push, merge the pull request after its checks pass, and the merge
   closes the feature as integrated. Nothing runs there; do not call
   `empirical_feature_finalize` unless the action names it (older work
   and strict binding still finalize there, without full CI).
   Never merge a dirty checkout; satisfy the PR checks and review before merging.
   Implement completion projects approved capability deltas and refreshes
   repository context itself: commit the returned `pendingPaths` with the
   implementation so Review sees them. If it refuses with
   `CONTEXT_REFINEMENT_REQUIRED`, stage new files, inspect repository
   evidence, replace every reported refinement-required topic, remove its
   managed marker, and complete Implement again. A saved feature already in
   Context completes it the same way. When Review is returned, call `empirical_review` without a submission,
   honor bot setup-required guidance or start the required fresh isolated
   reviewer invocation, then record its packet-bound canonical result and use
   that receipt. Complex features started on this version review before
   Verify, so run no tests for review and do not change source during Verify
   (a committed change needs a new review, `REVIEW_STALE`).
   Ask the reviewer for structured findings with a severity and
   category: critical, high, medium-or-higher security and acceptance findings
   block; other medium and low findings, including low security hardening
   advice, are deferred automatically and never start another fix lap.
   When `triage.exits` offers `follow-up`, offer the user one follow-up
   ticket for the deferred findings and create it only on a yes. Always name the
   exact `triage.failedCriteria` and `triage.blockingFindingIds` that prevent
   review approval and explain the next repair. One repair round is the budget:
   when `triage.mustChoose` is true, stop and let the user choose from
   `triage.exits`, converging first (open or merge the pull request and track
   what remains), one more fix lap with its cost, or stop. Never start a
   further lap without that choice; explain that it controls this feature only
   and does not approve a merge, release, or publication. Blocking findings and
   failed criteria are never deferred. After a fix, the next review packet
   carries `reReview` and only the delta since the previous reviewed head;
   the reviewer repeats ids of findings still open and omits fixed ones, and
   `triage.findingHistory` reports each id as open, fixed, deferred or new.
   A credential value is never a review tool input or chat text.
   If the user declines bot setup, call `empirical_configure` with review mode
   `fresh-context` and report that explicit fallback before preparing review;
   never degrade silently. Preserve a saved `fresh-context` choice without
   offering bot setup again or requesting a reviewer credential. Enable the bot
   later only on an explicit user request to change review mode.
   When Deliver returns a source/evidence review-required packet, run the same
   isolated boundary on that exact remote base/head diff; request changes keep
   the PR draft and a new head requires a new packet. Report the exact highest
   completion level. Stop at Done, Blocked, Awaiting Human, or pending on-demand
   verification; show the status card at each of those stops and resume the same
   revision when the user requests tests or more edits.
9. The saved `mockupsBeforeCoding` preference controls new required UI mockups.
   Honor No without asking again; change it only on an explicit user request via
   `empirical_configure`. Existing approved designs retain fidelity checks.
   When a phase asks for a mockup, build the directions it names, then run
   `empirical mockups` and give the user the address it prints. That command is
   public on purpose: a person clicks through and chooses. Record their choice,
   and anything the mockup revealed that the criteria do not cover, before the
   contract freezes. Never approve a design on the user's behalf.
10. After Complex Specify passes, `empirical_handoff` may offer Continue here,
   Save for later, or one detected agent. Detection and Save launch nothing;
   another runtime requires explicit approval of its exact target, cwd, and argv.
   For authorized host-native sub-agents, use the delegation bridge below;
   this is separate from external-agent executable handoff.
11. When a packet carries `featureSize` with `decisionPending` (a large Complex
   feature), present the split option before implementing: propose small,
   independently shippable slices, each started as its own feature with its own
   draft PR, or keep it as one. Record the user's choice with
   `empirical_split_decision` (keep requires a reason). It never blocks gates.
12. When a feature genuinely cannot satisfy its next gate -- its pull request
   was merged outside the flow, the work was abandoned or superseded, or the
   proof the gate requires is never coming -- do not fabricate evidence, retry
   a gate that cannot pass, or leave the feature selected. Call
   `empirical_feature_close` with the user's stated reason. It previews by
   default: show the exact plan and call it again with `approved` only after
   the user approves that exact closure. On a host without a confirmation form,
   relay the previewed `revision` for closure or `planDigest` for cleanup; a
   missing or stale binding refuses instead of applying a changed plan. Use
   `mode` `phase` to step past one stage and `feature` to end the feature. For
   `merged-externally` pass the pull request number; Empirical observes the
   merge itself and refuses unless it is genuinely merged into the target
   branch. Closure records why the
   feature stopped and never what it achieved: it adds no completion fact and
   writes no receipt, so never report a closed feature as verified or
   delivered. A forced advance never skips Shape, Specify, Verify or Review;
   a feature stuck there is closed, not advanced. When Doctor reports
   warnings or errors, use `empirical_doctor_fix` instead of interpreting
   remediation text: show the user its preview (safe, needs approval, needs
   your choice, manual only), ask for each decision's option and inputs, then
   apply with `approved: true`, the previewed `planDigest` and those
   `choices`. Doctor itself never repairs anything. When status or overview report
   features as merged, not closed -- their work already merged on the forge but
   nobody recorded it -- or the user asks to clean up finished work, call
   `empirical_reconcile`. It previews every unfinished feature with its merged
   pull request, or why it has none, and closes only the ones the user approves
   as `merged-externally` without selecting them; relay the previewed
   `planDigest` on a host without forms. Features before Implement, without
   proven merge evidence, or owned by another live checkout are never closed by
   reconcile: offer `empirical_feature_close` for them, or name the checkout to
   run reconcile from. Never delete spec folders to clear status. Closure,
   reconcile and cleanup need the user's own decision every time: YOLO and
   standing authorization never cover them, and never call them to escape work
   the gate still asks for. Where the host shows a form, Empirical asks the
   user itself.

### Delegate specification and implementation work

When the user authorizes sub-agent work, discover the actual host registry,
including available search/lazy loading, provider identity, tool schemas and
native spawn, lookup, status and stop capabilities. Pass that metadata to
`empirical_delegation_discover`; never guess an executable or tool prefix.
An unavailable capability is a concrete host limitation, not proof of a launch.

Prepare a bounded `consult`, `specify` or `implement` assignment with
`empirical_delegation_prepare`. Bind its stable assignment id, exact parent and
worker features/revisions, worker root, scope and native host instance. Set
`approved: true` only for work covered by the user's existing authorization.
Writable workers need a separate registered worktree with their own selected
spec in the required phase. Before a writable worker starts, run
`empirical_worktree_prepare` with `target` set to its worker root: preview, show
the paths, and apply the returned token in the same turn. Consult needs real
host-enforced read-only access; prompt text does not provide that enforcement.
Honor existing scope and tracker gates.

Preparation reserves ownership before dispatch. Execute the returned intent
using its actual native tool and arguments, then submit only its observed,
normalized result to `empirical_delegation_accept`. Continue already-authorized
work without another permission prompt. Use `empirical_delegation_status` to
observe or cancel. Reconcile an uncertain launch by its stable identity before
retrying; never blindly spawn another worker. Cancellation keeps the reservation
until native termination is confirmed. An unknown launch remains reserved even
after lookup finds no child, unless the host confirms cancellation that blocks
future spawns under the same dispatch key (`fencedCancellation`). A worker
message or terminal host status
does not complete a workflow, create evidence or imply verification: inspect the
worker's durable action and actual changes before completing its exact revision.

Do not invent state, weaken acceptance criteria, expose credentials, or persist
private chain-of-thought. Files under .empirical/ are the durable source of truth.

### Discover the host's Linear connection

Discover by capability, not by a guessed tool prefix. Inspect the actual host
registry/tool metadata (including provider/server identity, descriptions and input
schemas). Use host tool search or lazy loading when exposed; search for Linear
and the needed operation, not just one namespace string. In code-mode hosts,
inspect the available tool catalog (for example ALL_TOOLS) before invoking its
actual callable name. Names such as mcp__linear__list_teams,
mcp__plugin_linear__list_teams, or linear.list_teams are examples, not a whitelist.
A failed prefix filter is not evidence that Linear is absent. Do not substitute
an unrelated tool merely because its name or description contains "Linear";
confirm provider provenance and a compatible input schema.

Keep three facts separate: configured server, exposed callable tools, and a
successful authenticated request. An enabled OAuth entry in a host's MCP list
proves configuration, not that this session loaded its tools or can authenticate.
When the user selected Linear discovery, verify access with a bounded read-only
team-list request using the smallest supported limit. Never probe with a write.
Only claim authenticated access after a successful provider response. Classify
401/login failures, 403/permission failures, transport/rate-limit failures, and
missing tool exposure separately; none means "Linear is not installed".

For setup, discover only the needed read capabilities first: list teams, list
projects and list issue statuses. Do not require save_issue, save_comment, or
other future sync operations to begin read-only catalog discovery. Resolve later
capabilities when required and report the exact missing operation. A partial
capability set never authorizes changing authentication mode or pretending sync
is available.

Treat canonical linear.* names returned by the Empirical bridge as operation
identifiers, not literal host tool names. Map each to the discovered actual
callable tool and its documented schema. Preserve operation semantics, target,
authorized fields, bounded pagination and normalized result validation. Do not
invent an argument translation, drop a required field, or replace an unavailable
write with another operation; report the precise capability/schema gap instead.

Before reporting missing tools, exhaust the exposed registry and any available
host search/lazy-load path. If the user shows an enabled OAuth server but tools
remain unexposed, say "Linear is configured, but this session does not expose
<needed capability>" and give host-specific exposure/reload recovery. Do not ask
them to add an already configured server or log in again without an authentication
failure. Do not infer a need for an API key from missing names, partial tools,
permission errors or transient failures. Keep the chosen MCP/OAuth route; offer
host-file credentials only after actual discovery/recovery checks and an explicit
user choice to use that alternative. Never inspect private host OAuth stores.


Use Empirical MCP operations first. Use empirical __internal only when MCP is unavailable; it is a private agent fallback, never a command for the user to run. When the empirical MCP tools are missing from this session, or report an older version than `empirical --version`, continue through that fallback and tell the user once, in one line, that a new agent session restarts the server; never ask them to configure it.
