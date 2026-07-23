# Production Runbook

## Encryption Profile

| Resource                | Method                                     | Verification                                                                                   |
| ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| PostgreSQL data volume  | Host LUKS or provider-managed encryption   | `lsblk -o NAME, TYPE, FSTYPE, MOUNTPOINTS` + `cryptsetup status` or cloud-provider attestation |
| Backups                 | OpenSSL AES-256-CBC with separate key file | Decrypt + `pg_restore --list`                                                                  |
| Transport (browser)     | Traefik TLS termination                    | SSL Labs test or `curl -vI https://...`                                                        |
| Transport (API ↔ DB)    | Isolated Docker network                    | `docker network inspect`                                                                       |
| Transport (API ↔ Redis) | Isolated Docker network + Redis password   | `docker network inspect` + `redis-cli AUTH` test                                               |

## Secret Management

| Secret                | Source                           | Rotation              | Owner                   |
| --------------------- | -------------------------------- | --------------------- | ----------------------- |
| `DATABASE_URL`        | Mounted file or Docker secret    | On credential change  | Infrastructure operator |
| `REDIS_URL`           | Mounted file or Docker secret    | On credential change  | Infrastructure operator |
| `CSRF_SECRET`         | Mounted file or Docker secret    | Quarterly or incident | Infrastructure operator |
| `CORS_ORIGIN`         | Environment variable             | On domain change      | Infrastructure operator |
| `RESEND_API_KEY`      | Mounted file or Docker secret    | On incident           | Infrastructure operator |
| `EMAIL_FROM`          | Environment variable             | On domain change      | Infrastructure operator |
| Backup encryption key | Separate file, different storage | Quarterly or incident | Infrastructure operator |

### Creating Secrets

```bash
# Generate a CSRF secret
openssl rand -base64 48 > secrets/csrf_secret

# Set database URL
echo "postgres://planner:$(openssl rand -base64 24)@postgres:5432/planner" > secrets/database_url

# Set Redis URL
echo "redis://:$(openssl rand -base64 24)@redis:6379" > secrets/redis_url

# Backup encryption key
openssl rand -base64 32 > secrets/backup_key

# Resend API key (from https://resend.com/api-keys) - password reset email
printf '%s' 're_xxxxxxxx' > secrets/resend_api_key
```

Every secret file must be readable by uid 1000, the non-root `node` user the API
runs as:

```bash
chown 1000:1000 secrets/*
chmod 400 secrets/*
```

A root-owned secret file reads as empty inside the container rather than
failing loudly.

### File-Based Configuration

Set `DATABASE_URL_FILE`, `REDIS_URL_FILE`, `CSRF_SECRET_FILE`, or `RESEND_API_KEY_FILE` to read secrets from files instead of environment variables. The file path is read at startup and its contents (with trailing newline stripped) used as the secret value. File-based values take precedence over direct environment variables.

### Email Delivery

`RESEND_API_KEY` is the one secret that is optional. Left empty, the API logs
password reset links to its own stdout instead of sending them, so the reset
flow still completes for anyone reading `docker compose logs api` - useful in
staging, not acceptable in production. `EMAIL_FROM` must sit on a domain
verified in Resend or every send is rejected.

## Deployment

### Prerequisites

- Docker and Compose plugin installed
- Secrets created in `/etc/planner/secrets/` or equivalent
- TLS certificates configured in Traefik

### Deploy

```bash
docker compose -f compose.prod.yml up -d
```

The migration service runs first, then the API and app start. Check health:

```bash
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs migration
```

### Provision User

```bash
docker compose -f compose.prod.yml exec api node dist/db/provisionUser.js \
  --production \
  --email admin@example.com \
  --password-file /run/secrets/admin_password
```

The provision script reads the password from a protected file or hidden stdin (`--password-stdin`). Never pass passwords as command-line arguments.

### Migrate

Migrations run automatically as a one-shot service before the API starts. To run manually:

```bash
docker compose -f compose.prod.yml run --rm migration
```

### Rollback

1. Scale down the API: `docker compose -f compose.prod.yml stop api`
2. Run the down migration (if available) or restore from backup
3. Restart: `docker compose -f compose.prod.yml up -d`

## Backup

### Create Backup

```bash
docker compose -f compose.prod.yml exec -T postgres \
  pg_dump -U planner planner | \
  openssl enc -aes-256-cbc -salt -pass file:/run/secrets/backup_key \
  > /backups/planner-$(date +%Y%m%d).sql.enc
```

### Restore Backup

```bash
# In an isolated environment
openssl enc -d -aes-256-cbc -pass file:/path/to/backup_key \
  < /backups/planner-YYYYMMDD.sql.enc | \
  psql -U planner planner
```

### Verify Restore

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM collections;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM habits;
-- Verify login works with the restored account
```

## Session Revocation

### Revoke All Sessions for a User

```sql
UPDATE sessions SET revoked_at = NOW(), revoke_reason = 'manual-revoke'
WHERE user_id = '<user-id>' AND revoked_at IS NULL;
```

### Revoke a Specific Session

```sql
UPDATE sessions SET revoked_at = NOW(), revoke_reason = 'manual-revoke'
WHERE id = '<session-id>' AND revoked_at IS NULL;
```

### Block Immediate Access

After revocation, existing Socket.IO connections are evaluated for expiry/revocation during the periodic revalidation cycle (every 60 seconds). To force immediate disconnect, restart the API:

```bash
docker compose -f compose.prod.yml restart api
```

## Go-Live Evidence

| Date | Operator | Item                           | Command / Result | Artifact |
| ---- | -------- | ------------------------------ | ---------------- | -------- |
|      |          | Storage encryption verified    |                  |          |
|      |          | Encrypted backup created       |                  |          |
|      |          | Backup restored in isolation   |                  |          |
|      |          | Row counts match post-restore  |                  |          |
|      |          | Login + read smoke test passed |                  |          |
|      |          | Security headers verified      |                  |          |
|      |          | Cookie attributes verified     |                  |          |
|      |          | CSRF route-matrix passed       |                  |          |
|      |          | Container vulnerability scan   |                  |          |
|      |          | Production dependency audit    |                  |          |

## Monitoring and Alerts

### Log Aggregation

Security events are emitted as newline-delimited JSON via `console.log` by `api/src/utils/securityLogger.ts`. Each event includes `id`, `timestamp`, `type`, `requestId`, `userId`, `ip`, and optional `metadata`. Collect these logs with your infrastructure logging agent (e.g., Loki, Datadog, CloudWatch).

### Alert Rules

Configure alerts in your monitoring system for each of the following conditions. Alerts should notify the infrastructure operator (PagerDuty: PD-INFRA) with escalation to the security lead within 30 minutes if unacknowledged.

| Rule                      | Trigger                                                                    | Event type(s)                                                           | Threshold                                               | Severity               |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| Repeated auth failure     | `auth:login:failure`                                                       | `rate-limit:activated`, `rate-limit:exceeded`                           | ≥5 failures per IP or user within 15 min                | P1 — escalate          |
| Unexpected registration   | `auth:register:failure` (rate-limited)                                     | `auth:register:success` (when disabled)                                 | Any occurrence with `PUBLIC_REGISTRATION_ENABLED=false` | P1 — escalate          |
| Unexpected password reset | `auth:password:reset:request`                                              | `auth:password:reset:complete`                                          | Any occurrence with `PASSWORD_RESET_ENABLED=false`      | P1 — escalate          |
| Redis unavailable         | Application logs show connection error                                     | Redis client `error` event                                              | Any occurrence                                          | P1 — escalate          |
| Migration failure         | `migration:failed`                                                         | `migration:started` without matching `migration:completed` within 5 min | Any occurrence                                          | P0 — immediate         |
| Backup failure            | `backup:failed`                                                            | Expected `backup:created` not received                                  | Scheduled backup does not complete on time              | P1 — next business day |
| Backup restore failure    | `backup:restored` without matching `backup:restore:verified` within 15 min | `backup:restore:verified`                                               | Missing verification event                              | P1 — escalate          |
| Session revocation        | `auth:session:revoked`                                                     | Automated mass revocation                                               | >5 revocations within 5 min (possible compromise)       | P1 — investigate       |
| Provisioning activity     | `provisioning:user:created`                                                | Any occurrence outside planned maintenance                              | Any occurrence                                          | P1 — investigate       |

### Dashboard

Create a monitoring dashboard with:

- Auth success/failure rate (last 1h, 24h)
- Active sessions count
- Rate-limit activation frequency
- Migration status (latest)
- Backup age (hours since last successful backup)
- Redis and PostgreSQL connection health
- API 4xx/5xx rate per route
- CSRF rejection rate
- Request latency p50/p95/p99

## Incident Response

### Incident Owner

The infrastructure operator listed in the secret rotation table is the incident owner. If unavailable, the backup operator assumes responsibility.

**Contacts:**

| Role                    | Contact                                   |
| ----------------------- | ----------------------------------------- |
| Infrastructure operator | `infra@planner.app` (PagerDuty: PD-INFRA) |
| Backup operator         | `ops@planner.app` (PagerDuty: PD-OPS)     |
| Security lead           | `security@planner.app`                    |
| Engineering lead        | `eng@planner.app`                         |
| DPO (ANPD)              | `dpo@planner.app`                         |

**Escalation:** Infrastructure operator → Backup operator → Security lead → Engineering lead, with 30-minute acknowledgment SLA for P0 incidents.

### Containment

1. Revoke all sessions (see Session Revocation above).
2. Rotate all secrets (see Secret Management above).
3. If the API may be compromised, restart with fresh containers.
4. Capture the container logs for evidence.
5. If a compromised secret is identified, rotate immediately and revoke all sessions for affected users.
6. If container compromise is suspected, tear down and rebuild from known-good images.
7. Isolate the affected container(s) from the backend network:

   ```bash
   docker network disconnect planner_backend <container-id>
   ```

### Secret/Key Rotation

1. Generate a new secret value.
2. Update the mounted secret file or Docker secret.
3. Restart the affected service.
4. Verify the new secret is in use via health checks.
5. Record the rotation date and reason (see Evidence Preservation).

### Evidence Preservation

Preserve the following for incident analysis:

- Container logs for the affected period
- Database snapshots from before and after the incident (via `pg_dump`)
- Any alert notifications and timestamps
- Operator actions and timestamps (logged in the incident timeline)
- Security logs (JSON lines — see `api/src/utils/securityLogger.ts`)
- Incident records must be retained for a minimum of **5 years** for compliance with ANPD (LGPD) record-keeping requirements

**Retention:**

| Artifact                   | Retention | Disposal                       |
| -------------------------- | --------- | ------------------------------ |
| Security logs              | 5 years   | Secure erase after retention   |
| Database snapshots         | 2 years   | `shred` or `secure-delete`     |
| Container logs             | 1 year    | Automatic log rotation         |
| Incident record (markdown) | 5 years   | Archive in incident repository |

### Post-Incident Review

1. Schedule a post-incident review within 5 business days.
2. Document the root cause, timeline, and remediation steps.
3. Update the runbook with any gaps identified.
4. If the incident involved a security vulnerability, file a security advisory.

### Notification (ANPD / LGPD)

If user personal data is affected, assess notification requirements under Lei Geral de Proteção de Dados (LGPD / Lei nº 13.709/2018).

**Assessment workflow:**

1. **Determine severity:** Was there unauthorized access to personal data? If yes, proceed.
2. **Risk to data subjects:** Can the incident cause harm (identity theft, fraud, reputational damage, discrimination)? If yes, notify.
3. **ANPD notification:** Submit to ANPD within **10 business days** of becoming aware of the incident, containing:
   - Description of the nature of the affected personal data
   - Affected data subjects
   - Technical and security measures applied
   - Risks and mitigation steps
   - Contact for the Data Protection Officer (DPO)
4. **User notification:** Communicate to affected users without undue delay, describing:
   - What happened and when
   - What personal data was affected
   - Measures taken and planned
   - Steps users should take to protect themselves
   - DPO contact for questions
5. **Documentation:** Record all notifications, responses, and ANPD communications in the incident record.
6. **No notification required** if:
   - The incident poses no risk to data subjects
   - The data was anonymized or encrypted with keys not compromised
   - Document the rationale for non-notification in the incident record.
