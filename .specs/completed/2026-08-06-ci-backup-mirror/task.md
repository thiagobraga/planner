# CI Backup Mirror — Tasks

## Research and decision

- [n] Confirm which backup platform is the best fit for this repo: GitLab CI, self-hosted runner, or another external CI service.
- [n] Verify the free-tier limits and mirroring support needed for the chosen platform.
- [n] Identify the smallest deployable path that can run without GitHub Actions.
- [n] Decide whether the fallback should mirror code continuously or only sync on-demand during incidents.

## Design

- [n] Define the failover trigger for switching from GitHub Actions to the backup CI path.
- [n] Specify which jobs must run in the backup path: build, test, deploy, or all three.
- [n] Specify how shared scripts, container images, and environment variables will be reused.
- [n] Define how secrets will be stored and rotated in the backup system.

## Implementation plan

- [n] Map the repository sync mechanism to the chosen provider.
- [n] Draft the backup CI pipeline configuration.
- [n] Draft the deployment step so it can promote only when the primary CI is unavailable.
- [n] Add any required documentation or runbook entries for incident use.

## Verification

- [n] Run the backup pipeline in a non-production context.
- [n] Confirm the mirrored source can build and test successfully.
- [n] Confirm deploy works from the fallback path.
- [n] Confirm the primary GitHub Actions path still remains the default.