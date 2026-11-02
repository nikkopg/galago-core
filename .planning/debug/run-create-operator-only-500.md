---
status: diagnosed
trigger: "G-04-7: tRPC run.create returns HTTP 500 INTERNAL_SERVER_ERROR (raw OperatorOnlyCommandError) instead of BAD_REQUEST on live next dev; REST /api/runs returns 400; unit test passes"
created: 2026-10-30T00:00:00Z
updated: 2026-10-30T01:00:00Z
goal: find_root_cause_only
symptoms_prefilled: true
audit_acknowledged:
  milestone: v2
  at: 2026-11-02
  status: diagnosed
---

## Current Focus

bug_class: Bohrbug (deterministic given the trigger sequence: singleton created, then any server recompile)
hypothesis: RunStore.global is a process-global singleton (global.__global_run_store_key) that survives Next dev's per-compile require-cache purge. After any server recompile, the router runs in a NEW module instance (new OperatorOnlyCommandError class) but calls createFromProtocol on the OLD RunStore instance, whose method closes over the OLD module's OperatorOnlyCommandError. runs.ts's own instanceof passes (same old instance); router's instanceof fails -> `throw e` -> 500.
test: own next dev copy on :3012 — (1) fresh server, first request run.create protocol 2 -> expect 400; (2) trigger compile of another entry (GET /api/runs); (3) run.create again -> expect 500
expecting: 400 then 500 confirms; 500 on a fresh first request refutes
next_action: none — diagnosis complete (find_root_cause_only); hand back ROOT CAUSE FOUND

candidate_causes:
  - "code: router catch relies on class identity (instanceof) for errors thrown by a process-global singleton whose methods belong to an earlier module instance — CONFIRMED"
  - "environment: Next dev NextJsRequireCacheHotReloader purges webpack(-api)-runtime + all page entries from require.cache after every server compile, re-evaluating server modules while `global` persists — CONFIRMED (necessary trigger)"
  - "code: duplicate import specifiers ('../operatorOnlyCommands' vs './operatorOnlyCommands' vs '@/server/operatorOnlyCommands') creating two module ids — ELIMINATED (fresh server: identity true, 400)"
  - "config/test: vitest mocks RunStore so real identity never exercised — ELIMINATED (operatorOnly.test.ts uses the real RunStore + real runRouter; it passes because vitest has one module graph and no purge)"
  - "code: ES target / class transpilation breaking instanceof for Error subclasses — ELIMINATED (fresh server: errInstanceofCurrent true)"
and_gate: "yes — the 500 requires BOTH (a) the instanceof-on-singleton-output pattern in server/routers/run.ts with RunStore.global pinned on `global`, AND (b) a module re-instantiation after the singleton was created (next dev recompile). Neither alone produces it."

## Symptoms

expected: POST /api/trpc/run.create {"json":{"protocolId":2}} for a protocol with a stack acknowledge_failure step returns tRPC BAD_REQUEST (HTTP 400) with the refusal's own message (server/routers/run.ts ~line 93).
actual: HTTP 500 INTERNAL_SERVER_ERROR; body message is the correct refusal text; stack `OperatorOnlyCommandError: Step 0 sends "acknowledge_failure"... at RunStore.createFromProtocol (webpack-internal:///(api)/./server/runs.ts:181:27) ... at async eval (webpack-internal:///(api)/./server/routers/run.ts:69:29)`.
errors: INTERNAL_SERVER_ERROR with raw OperatorOnlyCommandError stack
reproduction: next dev -p 3011 on a copy of controller/ at HEAD cb8fbfe; protocol 2 = one step {toolType:"stack", command:"acknowledge_failure"}; POST /api/trpc/run.create {"json":{"protocolId":2}}
started: Phase 04 (OPR-04 enqueue guard); found in UAT 2026-10-30
already_ruled_out: wrong message (message correct, not wrapped); enqueue guard itself (works, audited stage=enqueue); REST POST /api/runs returns 400 (switch on e.name)

## Eliminated

## Evidence

- timestamp: 2026-10-30T00:00:00Z
  checked: diff of server/routers/run.ts, server/runs.ts, server/operatorOnlyCommands.ts, server/tools.ts, pages/api/runs/index.ts between working tree and scratch app copy
  found: identical
  implication: live repro reflects the current source

- timestamp: 2026-10-30T00:05:00Z
  checked: server/runs.ts RunStore.global, server/command_queue.ts:1498
  found: RunStore.global caches `new RunStore()` on `global.__global_run_store_key` (process global, never reset); CommandQueue.global likewise stores `new CommandQueue(RunStore.global)`. createFromProtocol references its module-scope OperatorOnlyCommandError (throw at runs.ts:231, rethrow check at :270).
  implication: the RunStore instance (and therefore the createFromProtocol code + class bindings it executes) is pinned to whichever module instance first touched RunStore.global

- timestamp: 2026-10-30T00:06:00Z
  checked: node_modules/next 13.1.2 dist/build/webpack/plugins/nextjs-require-cache-hot-reloader.js
  found: on every server compilation afterEmit, Next dev deletes webpack-runtime.js and webpack-api-runtime.js plus every pages/* entry from require.cache. The next request re-requires a fresh runtime with an empty __webpack_module_cache__, so every module (runs.ts, operatorOnlyCommands.ts, routers/run.ts) is re-evaluated with NEW class objects. `global` is not touched.
  implication: in next dev, after the first on-demand compile of any other page/API route (or a file save), router-side classes != classes captured by the pinned RunStore instance

- timestamp: 2026-10-30T00:07:00Z
  checked: live dev .next/server timestamps (scratch app on :3011)
  found: server entries compiled at 06:07 (_app/index), 06:08 (api/trpc, tools, webpack-api-runtime), 06:10 (_error), 06:15 (pages/runs), 06:16 (api/runs) — several recompiles during the UAT session after the tRPC API was first loaded
  implication: the UAT server went through multiple require-cache purges after RunStore.global was first created

- timestamp: 2026-10-30T00:08:00Z
  checked: test/operatorOnly.test.ts harness
  found: uses real RunStore + real runRouter.createCaller in one vitest module graph (vi.mock('@/server/runs') passes importOriginal through); only db and command_queue are faked. Single module instance, no cache purge -> class identity always matches.
  implication: test cannot observe the dev re-instantiation divergence; it is not a mocking gap of RunStore itself

- timestamp: 2026-10-30T00:09:00Z
  checked: live UAT dev log scratchpad/dev.out
  found: "Database connected" (top-level side effect of db/client.ts) printed 6 times — once after each on-demand compile (/api/trpc 23:08, /tools/[id] 23:10, /_error 23:10, /runs 23:15, /_error 23:16, /api/runs 23:16)
  implication: server modules are re-evaluated after every compile in next dev; module-scope classes are recreated each time

- timestamp: 2026-10-30T00:55:00Z
  checked: differential repro on isolated copy (scratchpad/app3012, DB backed up from the UAT copy, next dev -p 3012)
  found: STEP1 fresh server first run.create {protocolId:2} -> HTTP 400 BAD_REQUEST (stack "TRPCError"); STEP2 repeat, no recompile -> 400; STEP3 GET /api/runs (first hit, triggers compile) -> 200; STEP4 run.create -> HTTP 500 INTERNAL_SERVER_ERROR, stack head "OperatorOnlyCommandError" (exact UAT symptom); STEP5 repeat -> 500
  implication: the 500 appears only after a server recompile following RunStore.global creation — hypothesis CONFIRMED; it is not a permanent mapping defect

- timestamp: 2026-10-30T00:55:50Z
  checked: prediction — after recompile, run.create {protocolId:999}
  found: HTTP 500 INTERNAL_SERVER_ERROR, stack "ProtocolNotFoundError" (should be NOT_FOUND)
  implication: every class-identity branch in run.create's catch (ProtocolNotFoundError, OperatorOnlyCommandError, ProtocolGenerationFailedError, ProtocolParamsInvalidError) is defeated the same way; the defect is pre-existing in the pattern, Phase 04 merely added a new branch that exposed it

- timestamp: 2026-10-30T00:56:20Z
  checked: identity probe added to scratch copy's router catch only (not repo source)
  found: after recompile: {storeIsCurrentClass:false, errIsCurrentClass:false, errCtorName:"OperatorOnlyCommandError", errInstanceofCurrent:false}. Negative control on a freshly restarted server, first call: {storeIsCurrentClass:true, errIsCurrentClass:true, errInstanceofCurrent:true} -> 400. Then GET /runs (a non-API page compile) -> next run.create: all false -> 500
  implication: direct observation — RunStore.global is an instance of a STALE RunStore class from an earlier module instance; the error it throws is a same-named but different OperatorOnlyCommandError class. Any server compile (API or page) triggers it.

- timestamp: 2026-10-30T00:58:30Z
  checked: production build — scratch copy scratchpad/appprod (scratch-only next.config: eslint.ignoreDuringBuilds + typescript.ignoreBuildErrors to get past the unrelated RunRecoverySection.tsx:268 lint error), `next build` OK, `next start -p 3013`
  found: run.create(2) first -> 400 BAD_REQUEST; then GET /api/runs, /runs, /tools, /tools/1, /protocols, run.all, /nonexistent, POST /api/runs (400) -> run.create(2) -> 400 BAD_REQUEST; run.create(999) -> 404 NOT_FOUND; probe identity true throughout. Restarted, REST POST /api/runs FIRST (singleton created by the /api/runs entry), then tRPC run.create(2) -> 400, probe identity true.
  implication: production (next start, as the galago-web container runs) is NOT affected: no require-cache purge, and all API entries share one webpack-api-runtime module cache. The defect is next-dev-only (but hits every dev session after the first recompile). No getServerSideProps/getInitialProps/middleware/instrumentation import server code, so no second (webpack-runtime) instance exists in prod.

- timestamp: 2026-10-30T00:59:20Z
  checked: scratch vitest scratchpad/app3012/test/devReloadIdentity.test.ts (harness copied from operatorOnly.test.ts; NOT in repo)
  found: control (single module graph) -> {TRPCError, BAD_REQUEST} PASS; `vi.resetModules(); (await import("@/server/runs")).default.global; vi.resetModules();` then fresh runRouter.createCaller({}).create -> {TRPCError, INTERNAL_SERVER_ERROR} FAIL
  implication: the dev purge is reproducible in vitest with vi.resetModules() around RunStore.global creation — usable as the RED regression test for the fix; explains why operatorOnly.test.ts (no reset) passes

## Resolution

root_cause: "server/routers/run.ts classifies run.create errors with `instanceof` against its own module's classes, but createFromProtocol runs on RunStore.global — a singleton pinned on `global.__global_run_store_key` by whichever module instance created it first. Next dev (13.1.2 NextJsRequireCacheHotReloader) purges webpack-api-runtime and all page entries from require.cache after every server compile, so the router is re-evaluated with new OperatorOnlyCommandError/Protocol*Error classes while the stale RunStore keeps throwing the old ones; every instanceof branch misses and `throw e` becomes INTERNAL_SERVER_ERROR (500). Dev-only: production next start has no purge and one shared api runtime (verified 400/404)."
fix: (not applied — find_root_cause_only). Direction: make run.create's error mapping independent of module-instance class identity (e.g. match on error `name` as pages/api/runs does, or a Symbol.for brand / exported isXError(e) guard) for all four branches (ProtocolNotFoundError, OperatorOnlyCommandError, ProtocolGenerationFailedError, ProtocolParamsInvalidError); alternatively stop pinning behaviour on `global` (keep only the runs Map on global, construct RunStore per module instance). Add a vitest regression using vi.resetModules() around RunStore.global creation.
verification:
files_changed: []
