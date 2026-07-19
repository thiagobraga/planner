# Production Runbook

## Encryption Profile

| Resource | Method | Verification |
|----------|--------|--------------|
| PostgreSQL data volume | Host LUKS or provider-managed encryption | `lsblk -o NAME, TYPE, FSTYPE, MOUNTPOINTS` + `cryptsetup status` or cloud-provider attestation |
| Backups | OpenSSL AES-256-CBC with separate key file | Decrypt + `pg_restore --list` |
| Transport (browser) | Traefik TLS termination | SSL Labs test or `curl -vI https://...` |
| Transport (API ↔ DB) | Isolated Docker network | `docker network inspect` |
| Transport (API ↔ Redis) | Isolated Docker network + Redis password | `docker network inspect` + `redis-cli AUTH` test |

## Secret Management

| Secret | Source | Rotation | Owner |
|--------|--------|----------|-------|
| `DATABASE_URL` | Mounted file or Docker secret | On credential change | Infrastructure operator |
| `REDIS_URL` | Mounted file or Docker secret | On credential change | Infrastructure operator |
| `CSRF_SECRET` | Mounted file or Docker secret | Quarterly or incident | Infrastructure operator |
| `CORS_ORIGIN` | Environment variable | On domain change | Infrastructure operator |
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
```

### File-Based Configuration

Set `DATABASE_URL_FILE`, `REDIS_URL_FILE`, or `CSRF_SECRET_FILE` to read secrets from files instead of environment variables. The file path is read at startup and its contents (with trailing newline stripped) used as the secret value. File-based values take precedence over direct environment variables.

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

| Date | Operator | Item | Command / Result | Artifact |
|------|----------|------|------------------|----------|
| | | Storage encryption verified | | |
| | | Encrypted backup created | | |
| | | Backup restored in isolation | | |
| | | Row counts match post-restore | | |
| | | Login + read smoke test passed | | |
| | | Security headers verified | | |
| | | Cookie attributes verified | | |
| | | CSRF route-matrix passed | | |
| | | Container vulnerability scan | | |
| | | Production dependency audit | | |

## Incident Response

### Incident Owner

The infrastructure operator listed in the secret rotation table is the incident owner. If unavailable, the backup operator assumes responsibility.

### Containment

1. Revoke all sessions (see Session Revocation above).
2. Rotate all secrets (see Secret Management above).
3. If the API may be compromised, restart with fresh containers.
4. Capture the container logs for evidence.

### Secret/Key Rotation

1. Generate a new secret value.
2. Update the mounted secret file or Docker secret.
3. Restart the affected service.
4. Verify the new secret is in use via health checks.
5. Record the rotation date and reason.

### Evidence Preservation

Preserve the following for incident analysis:

- Container logs for the affected period
- Database snapshots from before and after the incident
- Any alert notifications and timestamps
- Operator actions and timestamps

### Notification

If user data is affected, assess whether notification is required under applicable regulations. Document the assessment and any notifications sent.
