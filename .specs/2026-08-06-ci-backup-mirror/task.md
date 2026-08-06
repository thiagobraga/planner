# CI Backup Mirror — Tasks

## Research and decision

- [ ] Confirm which backup platform is the best fit for this repo: GitLab CI, self-hosted runner, or another external CI service.
- [ ] Verify the free-tier limits and mirroring support needed for the chosen platform.
- [ ] Identify the smallest deployable path that can run without GitHub Actions.
- [ ] Decide whether the fallback should mirror code continuously or only sync on-demand during incidents.

## Design

- [ ] Define the failover trigger for switching from GitHub Actions to the backup CI path.
- [ ] Specify which jobs must run in the backup path: build, test, deploy, or all three.
- [ ] Specify how shared scripts, container images, and environment variables will be reused.
- [ ] Define how secrets will be stored and rotated in the backup system.

## Implementation plan

- [ ] Map the repository sync mechanism to the chosen provider.
- [ ] Draft the backup CI pipeline configuration.
- [ ] Draft the deployment step so it can promote only when the primary CI is unavailable.
- [ ] Add any required documentation or runbook entries for incident use.

## Verification

- [ ] Run the backup pipeline in a non-production context.
- [ ] Confirm the mirrored source can build and test successfully.
- [ ] Confirm deploy works from the fallback path.
- [ ] Confirm the primary GitHub Actions path still remains the default.

