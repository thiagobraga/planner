# CI Backup Mirror — Plan

## Context

GitHub Actions can become unavailable during platform incidents, so the fallback should keep deployments moving without making GitHub Actions the single point of failure.

The goal is not to replace GitHub Actions outright. The goal is to add a secondary CI/deploy path that can be used when GitHub-hosted workflows fail, while keeping the primary developer flow unchanged.

## Goals

- Keep the GitHub repository as the source of truth.
- Add a secondary CI system that can run build/test/deploy jobs independently.
- Make deployment possible even when GitHub Actions is degraded.
- Keep the fallback simple enough to trust during an incident.

## Constraints

- Prefer a low-ops setup over a complex multi-platform pipeline.
- Avoid duplicating business logic across two CI systems if a shared script or container entrypoint can be reused.
- Do not require the fallback path for normal day-to-day deploys unless the primary CI is unavailable.
- Keep secrets and environment configuration isolated per CI provider.

## Recommended shape

- Keep GitHub Actions as the default pipeline.
- Add a mirror or sync path that makes the repo available to the backup CI system.
- Reuse the same build, test, and deploy commands in both systems.
- Gate the backup deploy path behind an explicit incident/failover switch so it does not run accidentally.

## Evaluation points

- Whether GitLab CI is available on the desired free plan tier for the needed usage.
- Whether repository mirroring is available without paying for a higher plan.
- Whether a self-hosted runner or external CI service is simpler than GitLab for this repo.
- Whether the fallback can deploy from the mirrored source with the same artifacts and environment variables.

## Outcome

A documented backup CI/deploy design with a clear recommendation, a minimal implementation plan, and a failover runbook for incidents where GitHub Actions is unavailable.
