# RoboBuddy Benchmark v1: methodology and boundaries

## What is evaluated

This is an independent, public, simulator-only task-construction benchmark. A human freezes a selected fixed workcell, prompt, input track, model label/configuration, and execution budget. A model constructs four Python files, optional visual-only scene primitives, an explicit workflow mapping, and limitations. The benchmark runs the Python through a pinned copy of RoboBuddy IDE's simulation components and records observed modeled goal results.

The two tracks are **prompt only** and **prompt plus a supplied Lab Studio workflow**. Both receive the selected robot's capabilities, fixed workcell description, public goal rubric and empty starter files. “Prompt only” excludes the extra workflow; it does not withhold the API contract. The benchmark does not automatically judge free-text prompt meaning. Changing a prompt marks a custom condition, and does not silently change the fixed rubric.

## Scoring and failure handling

The motion score is the fraction of configured modeled motion goals passed, multiplied by 100 and rounded. A runtime fault, prohibited state, or causal violation gates the score to zero. Workflow coverage is checked separately and adds **no motion points**. A valid mapping is not proof that a node was executed, and human/unsupported/not-applicable classifications are permitted and visible for review. Chemical reactions, measurements, concentrations, endpoint accuracy, and laboratory safety are not graded here.

Source-plant grades also expose additional upstream evidence requirements. The motion score deliberately does not pretend to satisfy these; the complete upstream grade is retained in the evidence. Only its motion goals and prohibited/causal gates define this benchmark's declared metric.

Every attempted execution counts against the budget, including failed, cancelled and infrastructure-blocked attempts. Final results use the **last evaluated current submission**, not the best attempt. Changing a bundle invalidates its prior result. Finalizing an unevaluated submission gives zero. Infrastructure failure produces no motion score and is reported separately, not misclassified as model incompetence. A person may start another run to retry infrastructure; its separate run identity is retained.

G1's public goals are: both elbows reach at least 40 degrees, every joint returns within one degree of neutral after that pose, and at least two commands are executed. It has no walking, balance, grasping, or collision model. MicroDuck's goals are: ground-plane displacement of 0.8–1.6 metres, stopped commanded movement at the finish, and no fallen state. These are basic embodied-control diagnostics, not lab manipulation claims.

## Runtime provenance and execution semantics

RoboBuddy_IDE is pinned to `e87940e17271daff0390f6d38cbd4a27ddf18b48`. Lab-Studio_WebMCP is pinned to `e66472f898a6a5fb12d85f3f1d1f64ad10e48259`. The source workcell engine and robot visual revisions are recorded in `data/provenance.json`. CI checks out these dependencies with read-only permissions and no retained credentials. It does not modify, commit to, or deploy upstream repositories.

SO-101, OpenArm and LeKiwi Python is compiled with the original robot API shim in a fresh worker. The resulting public action trace is validated and replayed through the original source plant. **Python get_observation in these profiles returns shim command state, not live sensor feedback.** Actual score evidence is read from the separately replayed source plant. This track therefore measures open-loop program construction, not closed-loop perception or hardware control. G1 uses the original kinematic rig. MicroDuck uses the original asynchronous bridge and live policy simulator, with approximate dynamics and no hardware/RL-environment parity claim.

The four files are `main.py`, `trajectories.py`, `robot_config.py`, and `workcell.py`. The last file is informational metadata; editing it does not rebuild physical geometry. New asset primitives are translucent/wireframe visual guides in Three.js Y-up millimetres. They have no collision or grasp role. The fixed workcell's physical objects, goal predicates, and grader are not writable through benchmark tools. New physical scene synthesis would require additional reviewed geometry and independent grading and is outside v1.

## Workflow import

Import a self-contained Lab Studio lab or technique JSON containing `process.nodes`, `process.edges`, and `process.startNodeId`. Node identities, conditional branches and retry edges are preserved. Imports with unresolved `techniqueRefs` are rejected; export a resolved document through the ordinary Lab Studio interface. A source-pinned titration technique is provided as a real example, not an invented native integration.

Import is explicitly human-controlled. The benchmark does not scrape another site's private drafts or bypass Lab Studio's human-only Apply/Export boundary. Source claims inside uploaded JSON are not authenticated. Workflow text is untrusted data, never permission to change the evaluation rules. A full imported graph is frozen and hashed as part of the condition.

## Model identity, transport, comparisons

The browser agent host selects and runs the LLM. This static site does not make provider API calls and does not request or save API keys. Enter the actual provider, model/version, and relevant temperature/reasoning/agent configuration. Those labels are self-reported, not independently authenticated.

Native WebMCP tools register only when `document.modelContext.registerTool` is available and a human enables them. Without this API, the same visible staging and runtime controls work manually. There is no compatibility shim falsely reporting a native run. The measured transport is `webmcp`, `manual`, or `mixed`, based on actual operation entry points; human run setup itself is not counted as intervention.

Local comparison groups require the exact frozen condition hash, model configuration and transport. Prompt-only and workflow-assisted groups are not pooled. Failed/aborted/no-submission finalized runs count as zero; blocked infrastructure runs are displayed separately. Public reference demonstrations are permanently labeled `demo` and excluded. No synthetic model rankings are preloaded. Small samples are not evidence of broad model superiority; inspect each attempt and repeat under matched conditions.

## Reproducibility, storage and trust

Export each complete evidence JSON before closing the page. It includes frozen inputs, SHA-256 condition and bundle hashes, submitted files, workflow mapping, all attempts, observations, diagnostics, activity times and model configuration. The browser automatically retains compact comparison summaries only, not a central public leaderboard. Source-authored reference programs are publicly downloadable for human verification; this is a transparent development suite, **not a secret held-out assessment**.

The Python AST gate disallows unsupported imports, private access, dynamic evaluation and other out-of-scope constructs. A dedicated worker, line/event budgets and wall timeout bound normal submissions. These controls are not an adversarial security proof. A person with developer tools can alter any client-side app or local evidence. The site must not be used to execute hostile untrusted programs or certify financial, clinical, physical-robot or high-stakes decisions. No physical equipment is connected.

## Practical evaluation sequence

1. Choose a fixed task and exact prompt. Keep these constant between models.
2. Select the input track, workflow (when applicable), model metadata and budget. Start the run.
3. Enable native tools in a compatible host; give the model the copied agent instructions. For manual evaluation, import its task bundle and stage it.
4. Validate, execute, inspect diagnostics, and permit only budgeted repair. Finalize the current submission.
5. Export full evidence. Repeat matched conditions and compare transport-specific groups.

Source/API citations: the linked pinned upstream repositories, their MIT/third-party license notices under `runtime/`, the WebMCP specification at https://webmachinelearning.github.io/webmcp/, and GitHub Pages custom-workflow documentation at https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages.
