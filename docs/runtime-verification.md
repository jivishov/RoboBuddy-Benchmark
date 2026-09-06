# Runtime verification and integration details

Each deployed build includes `data/smoke-report.json`, with source-authored reference and no-op outcomes under the same 120-second wall budget as a model run. These are runtime checks, not model results. The three browser tests exercise the visible workflow, native tool handlers through mocked registration, and the real modeled runtimes. A frontier-LLM browser host is not tested by that mock.

A workcell whose reference check does not pass remains available as **exploratory**. Its runs can be exported but are excluded from the local model comparison. The interface displays this status rather than implying that every selectable workcell has passed. Infrastructure-blocked outcomes are never silently converted into model success or failure.

The exact benchmark source commit is included in each frozen condition hash. A new build cannot silently pool results with older code. Full imported Lab Studio workflow documents, including action parameters and initial state, are retained alongside the compact graph.

## Source plant timing

Plant ticks run independently of display refresh. Visualization can run faster than wall-clock motion; modeled time and wall duration are recorded separately. This prevents headless/software rendering speed from dominating a program's execution budget.

The source viewer advances one plant tick when applying an action. The benchmark's LeKiwi timing adapter debits that already-advanced tick from the subsequent sleep duration, matching the configured reference route's hold intervals without changing physics, geometry, goal predicates or source files. Other source-plant timing is unchanged. The timing adapter identifier is recorded in provenance and runtime evidence.

The executed action count is measured after accepted commands, not copied from the length of a submitted plan. The original planned count and full generated trace are retained for inspection. A nonzero final LeKiwi base command prevents success.

## MicroDuck loader and asset units

The pinned MicroDuck MuJoCo JavaScript loader requires dynamic code generation. The page Content Security Policy consequently permits `unsafe-eval` for compatibility. This is not a security boundary for hostile programs. Candidate Python remains checked and isolated as described in the methodology. Do not execute deliberately hostile inputs in this research workbench.

Visual-only primitive dimensions are declared in millimetres and converted to the renderer's units: source rigs use millimetres, while MicroDuck uses metres. Primitives do not create physical contact or chemical behavior.

## Deployment isolation

The main branch verifies the build and requests publication of that exact successful build. The publisher runs from this repository's configured `gh-pages` branch and checks the source SHA, repository, branch and build-job result before downloading the artifact. No environment protection is disabled. The deployed `data/deployment.json` identifies both the source build and release run. All repository writes remain inside `jivishov/RoboBuddy-Benchmark`.
