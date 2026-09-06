# Deployment and runtime verification

## Publication

The Python benchmark implementation committed at `8c10dbb734528c8b936126d571174400c99427a8` was preserved. A separately prepared JSON-only prototype was not substituted over that work.

The initial site's verified build is Actions run `34020967488`. Its `build` job passed; its original `deploy` job never started any steps. Publishing the same artifact from the configured `gh-pages` source succeeded in run `34021587582` on September 6, 2026. No environment protections or source repository settings were weakened.

The normal pipeline now builds/tests on `main`, then dispatches `publish-verified.yml` on `gh-pages` with the exact successful build run and source SHA. The publisher validates that build's repository, main-branch identity and successful build job, downloads only its static-site artifact, synchronizes this repository's Pages branch without force-pushing, deploys it, and checks live HTML, JavaScript and `data/deployment.json` over HTTPS. Release status appears in the separate **Publish verified benchmark build** run; dispatch success alone is not deployment success.

Live URL: https://jivishov.github.io/RoboBuddy-Benchmark/

Only `RoboBuddy-Benchmark` receives writes. `RoboBuddy_IDE` and `Lab-Studio_WebMCP` remain read-only, SHA-pinned build dependencies.

## Qualification evidence for the initial build

The CI browser suite completed successfully, but its smoke-report collection is not an assertion that every robot reference passed. Consult the published `data/smoke-report.json` before treating a workcell as a valid model comparison.

| Workcell | Reference / no-op result |
| --- | --- |
| SO-101 Burette Receiver Clearance Calibration | Reference 100%; no-op 0%; qualified |
| SO-101 Vacuum Workcell Keep-Clear Preflight | Reference 100%; no-op 0%; qualified |
| OpenArm Bimanual Heater and Ring-Stand Stack | Reference 100%; no-op 0%; qualified |
| Unitree G1 Kinematic Pose Inspection | Reference 100%; no-op 0%; qualified |
| SO-101 Measured Two-Bottle Transfer | Reference timed out; not qualified in this build |
| LeKiwi Beaker Courier | Reference 20%; not qualified in this build |
| MicroDuck policy demonstrator | Runtime initialization blocked by CSP; not qualified in this build |

These are CI reference/control checks, not LLM benchmark results. Native WebMCP registration was mocked in automated tests; no real model-host integration was verified. The UI remains a pilot for fixed workcells. Workflow coverage is structural, added assets are visual-only, and modeled motion scores do not establish chemical or hardware validity.

Start comparisons with the qualified workcells. Do not report scores from the three unqualified workcells as validated model comparisons until their reference/control evidence is repaired and rerun. Subsequent builds may supersede this initial snapshot; their own smoke report is authoritative.
