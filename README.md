# RoboBuddy Benchmark

[Open the benchmark](https://jivishov.github.io/RoboBuddy-Benchmark/)

A standalone WebMCP workbench for evaluating LLM-built robotic lab routines with two input tracks: **prompt only**, or **prompt plus a supplied Lab Studio workflow**. Every run freezes its conditions, accepts a four-file Python task bundle, executes it against a version-pinned modeled robot workcell, and retains observed outcomes and failed attempts.

## Included

- Seven public workcells across SO-101, OpenArm, LeKiwi, Unitree G1 and MicroDuck.
- Human-controlled run setup, optional native WebMCP, and honest manual fallback.
- Python task editor, visual-only 3D assets, complete workflow-node handling declarations, and deterministic structural checks.
- Actual RoboBuddy runtime components, model-specific motion rubrics, bounded retries, revision guards, trace/diagnostics and Stop.
- SHA-256 input/submission fingerprints, per-attempt evidence export and local transport-separated model comparisons.
- Real Lab Studio JSON import plus a source-pinned example technique. No cross-site private-state scraping.
- No provider keys, model API calls, physical robot access, invented model rankings, or upstream writes.

## Start

Select a workcell, track, exact model label/configuration, and attempt budget. Import a resolved Lab Studio lab/technique JSON for the assisted track. Click **Start run & freeze inputs**. In a native WebMCP-capable browser agent host, enable site tools and give the agent the copied instructions. Select the LLM in that host, not on this static site. In an ordinary browser, paste/import model output and use the same visible controls; the run is labeled manual.

The agent can inspect conditions/capabilities, stage a complete task, validate, run, repair within budget and finalize. Only a person creates the run and selects grading conditions. Export the complete evidence before leaving. Browser persistence contains compact comparison summaries, not full archived source/telemetry.

## Important boundaries

This v1 evaluates **program construction for fixed public workcells**, not arbitrary new physical-scene synthesis. Additional assets are visual guides only. Editing workcell.py does not alter the physical scene. Workflow coverage is structural and separate from motion scoring; it is not proof of chemistry or prompt-semantic correctness.

Source-plant profiles compile Python to an action trace and replay it. Their Python observation shim is not live sensor feedback. G1 is kinematic-only; MicroDuck is a live approximate policy simulation. No hardware or analytical validation is claimed. Public reference demos are excluded from model results. Model identity is self-declared; browser-side evidence is not tamper-proof or a secret held-out leaderboard.

Read [the methodology](docs/methodology.md) for scoring, provenance, limitations and reproducibility details.

## Local development

Node.js 22+ and Python 3 are sufficient for the static build/server. Download or clone the two **read-only** upstream snapshots:

```sh
git clone https://github.com/jivishov/RoboBuddy_IDE .upstream/ide
git -C .upstream/ide checkout e87940e17271daff0390f6d38cbd4a27ddf18b48
git clone https://github.com/jivishov/Lab-Studio_WebMCP .upstream/lab
git -C .upstream/lab checkout e66472f898a6a5fb12d85f3f1d1f64ad10e48259
npm test
npm run build
npm run serve
```

Open http://127.0.0.1:8765. `IDE_SOURCE` / `LAB_SOURCE` can point to already downloaded snapshots. Building and first simulation startup require network access to pinned upstream/CDN assets. An unavailable dependency is an infrastructure failure, not a model score.

Optional browser checks: `npm install`, `npx playwright install chromium`, then `npm run test:browser`. CI publishes test evidence alongside the deployment. Unit tests do not imply a native LLM-host integration was exercised.

## Repository isolation and deployment

All benchmark code and deployment writes stay in `jivishov/RoboBuddy-Benchmark`. CI reads pinned upstream commits without retained credentials, builds a separate runtime copy, tests, and deploys this repository's Pages artifact. **RoboBuddy_IDE and Lab-Studio_WebMCP are never modified.**

The source is MIT licensed. Upstream runtime/assets retain their original MIT and third-party notices, copied into the deployed `runtime/LICENSE` and `runtime/licenses/` paths.
