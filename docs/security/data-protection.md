# Data Protection

## Classification

| Class | Data | Examples |
|-------|------|----------|
| **Identity** | Email address | `user@example.com` |
| **Authentication** | Password hash, session token hash, CSRF token | Argon2id hash, SHA-256(session) |
| **Content** | Task titles/descriptions, habit names/notes, comments, collection names | User-generated strings |
| **Preferences** | Font, theme, locale, UI settings | `{ font: "lora", theme: "cream" }` |
| **Operational** | Request logs, rate-limit counters, activity feed | IP, timestamp, event type |
| **Backup** | Full database dump at rest | Encrypted volume snapshot |

## Encryption Boundaries

Per ADR-1, infrastructure encryption is mandatory; application-level field encryption is deferred.

| Boundary | Requirement | Mechanism |
|----------|-------------|-----------|
| Transport (browser → Nginx) | HTTPS, TLS ≥ 1.2 | Traefik terminates TLS |
| Transport (Nginx → API) | Plain HTTP over private Docker network | Isolated `backend` network |
| Transport (API → PostgreSQL) | `verify-full` TLS for remote; isolated network for same-host | Docker `data` network |
| Transport (API → Redis) | Password + isolated network | `REDIS_PASSWORD` + Docker `data` network |
| Storage (PostgreSQL data) | Encrypted at rest | Host-volume encryption (LUKS or provider-managed) |
| Backups | Encrypted with key stored separately | GPG or OpenSSL symmetric encryption |

### Future Field-Encryption Trigger

Application-level content encryption (task titles, descriptions, habit names, comments) will be specified when:

- The product must protect data from database operators or a live database compromise.
- The product markets itself as zero-knowledge or suitable for regulated health data.
- A separate envelope-encryption spec defines per-user data-encryption keys wrapped by KMS, authenticated encryption (AES-GCM), key versions, associated data, rotation, recovery, and blind indexes.

Do not introduce ad hoc `pgcrypto` calls or store encryption keys beside ciphertext before that spec.

## Retention

| Data | Retention | Deletion |
|------|-----------|----------|
| Active user account | Indefinite (until deletion request) | Hard-delete user, sessions, tasks, habits, comments, preferences |
| Expired/revoked sessions | 90 days after expiry | Cleanup job in migration or scheduled task |
| Rate-limit counters | TTL-bound (Redis) | Automatic expiry |
| Request logs | 30 days | Log rotation |
| Backups | 3 most recent + 1 monthly | Automated rotation |

## Log Redaction

The following must never appear in logs:

- Email addresses (hash or `user:{id}` instead)
- Passwords, password hashes, or password fragments
- Session tokens or CSRF tokens (raw or hashed)
- JWT payloads or signatures
- Task titles, descriptions, or other user content
- Habit names, notes, or completion data
- Comment bodies

Allowed in logs: user ID, request ID, event type, HTTP method, path, status code, rate-limit counter values, error codes, and generic `Authentication failed` messages.
