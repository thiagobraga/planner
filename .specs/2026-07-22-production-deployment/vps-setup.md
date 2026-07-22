# VPS setup — copy-paste sequence

Run in order. Steps 1–3 are local/GitHub, 4–8 are on the VPS.

Placeholders: `<VPS_IP>`, `<YOUR_EMAIL>`. Keep the real values out of tracked
files — put them in `docs/production-runbook.local.md` (gitignored, Phase 7).

> **Do not merge this branch to `main` until step 3 is done.** `deploy.yml`
> triggers on push to `main`; without the secrets the deploy job fails at SSH.

---

## 1. Generate the deploy keypair (local)

A dedicated key, not your personal one — it lives in GitHub's secret store.

```bash
mkdir -p ~/.ssh/keys
ssh-keygen -t ed25519 -f ~/.ssh/keys/planner_deploy -C "github-actions-planner-deploy" -N ""
```

Install the public half on the VPS:

```bash
ssh-copy-id -i ~/.ssh/keys/planner_deploy.pub ubuntu@<VPS_IP>
```

Capture the host key so CI can pin it instead of blindly trusting on first
connect:

```bash
ssh-keyscan -t ed25519 <VPS_IP>
```

Verify the key works and is restricted to what you expect:

```bash
ssh -i ~/.ssh/keys/planner_deploy ubuntu@<VPS_IP> 'echo OK; docker --version'
```

## 2. DNS

Add an A record at your `thiagobraga.dev` provider:

| Type | Name      | Value      |
| ---- | --------- | ---------- |
| A    | `planner` | `<VPS_IP>` |

Wait for propagation before running certbot in step 7:

```bash
dig +short planner.thiagobraga.dev
```

## 3. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions. Four secrets:

| Secret            | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| `SSH_HOST`        | `<VPS_IP>`                                              |
| `SSH_USER`        | `ubuntu`                                                |
| `SSH_KEY`         | full contents of `~/.ssh/keys/planner_deploy` (private) |
| `SSH_KNOWN_HOSTS` | the `ssh-keyscan` output line from step 1               |

```bash
gh secret set SSH_KEY < ~/.ssh/keys/planner_deploy
gh secret set SSH_HOST --body '<VPS_IP>'
gh secret set SSH_USER --body 'ubuntu'
ssh-keyscan -t ed25519 <VPS_IP> | gh secret set SSH_KNOWN_HOSTS
```

---

## 4. Clone the repo (VPS)

```bash
sudo mkdir -p /p/projects/planner
sudo chown ubuntu:ubuntu /p/projects/planner
git clone https://github.com/thiagobraga/planner.git /p/projects/planner
cd /p/projects/planner
```

## 5. Generate secrets (VPS)

Generate each password once in hex and reuse it across connection string and
password file to avoid initialization mismatches. Use hex instead of base64 to
avoid URL-corrupting characters (`/`, `+`, `=`):

```bash
sudo mkdir -p /etc/planner/secrets
cd /etc/planner/secrets
sudo chown ubuntu:ubuntu .
umask 077

PG_PASS=$(openssl rand -hex 24)
RD_PASS=$(openssl rand -hex 24)

printf '%s' 'planner'  > postgres_user
printf '%s' 'planner'  > postgres_db
printf '%s' "$PG_PASS" > postgres_password
printf '%s' "$RD_PASS" > redis_password

printf 'postgres://planner:%s@postgres:5432/planner' "$PG_PASS" > database_url
printf 'redis://:%s@redis:6379' "$RD_PASS" > redis_url

openssl rand -hex 32 > csrf_secret
openssl rand -hex 32 > backup_key

chmod 600 ./*
unset PG_PASS RD_PASS
```

Confirm the two passwords actually match their URLs before starting anything:

```bash
grep -q "$(cat /etc/planner/secrets/postgres_password)" /etc/planner/secrets/database_url && echo "postgres OK" || echo "POSTGRES MISMATCH"
grep -q "$(cat /etc/planner/secrets/redis_password)"    /etc/planner/secrets/redis_url    && echo "redis OK"    || echo "REDIS MISMATCH"
```

Point compose.prod.yml to `/etc/planner/secrets` in step 8 via environment override:

```bash
export POSTGRES_USER_FILE=/etc/planner/secrets/postgres_user
export POSTGRES_PASSWORD_FILE=/etc/planner/secrets/postgres_password
export POSTGRES_DB_FILE=/etc/planner/secrets/postgres_db
export DATABASE_URL_FILE=/etc/planner/secrets/database_url
export REDIS_URL_FILE=/etc/planner/secrets/redis_url
export CSRF_SECRET_FILE=/etc/planner/secrets/csrf_secret
```

## 6. Environment (VPS)

```bash
echo 'CORS_ORIGIN=https://planner.thiagobraga.dev' > /p/projects/planner/.env
```

## 7. nginx vhost + TLS (VPS)

Mirrors the existing `thiagobraga.dev.conf` pattern, but proxies to the app
container's loopback port instead of serving a static root.

```bash
sudo tee /etc/nginx/conf.d/planner.thiagobraga.dev.conf > /dev/null <<'EOF'
server {
  listen 80;
  listen [::]:80;
  server_name planner.thiagobraga.dev;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name planner.thiagobraga.dev;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;

    # Required for Socket.IO's websocket upgrade
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 300s;
  }
}
EOF
```

`$connection_upgrade` needs a map in the http context. Add it once:

```bash
sudo tee /etc/nginx/conf.d/00-upgrade-map.conf > /dev/null <<'EOF'
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}
EOF
```

> A blanket `Connection "upgrade"` on every request breaks plain HTTP keepalive.
> The map sends `upgrade` only when the client actually asked for it.

Then issue the certificate — certbot rewrites the vhost with the cert paths:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d planner.thiagobraga.dev
sudo nginx -t && sudo systemctl reload nginx
```

## 8. First deploy (VPS)

Images are only on GHCR after the first successful `deploy.yml` run, so either
merge to `main` first, or trigger it manually:

```bash
gh workflow run deploy.yml --ref feat/production-deployment
```

If the GHCR packages are still private, make them public once
(Profile → Packages → `planner-api` / `planner-app` → Package settings →
Change visibility). Otherwise the VPS needs `docker login ghcr.io`.

Then, on the VPS:

```bash
cd /p/projects/planner

# Point to /etc/planner/secrets
export POSTGRES_USER_FILE=/etc/planner/secrets/postgres_user
export POSTGRES_PASSWORD_FILE=/etc/planner/secrets/postgres_password
export POSTGRES_DB_FILE=/etc/planner/secrets/postgres_db
export DATABASE_URL_FILE=/etc/planner/secrets/database_url
export REDIS_URL_FILE=/etc/planner/secrets/redis_url
export CSRF_SECRET_FILE=/etc/planner/secrets/csrf_secret
export REDIS_PASSWORD_FILE=/etc/planner/secrets/redis_password

docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
docker compose -f compose.prod.yml ps
```

Expect: `migrate` `Exited (0)`, everything else `Up` and `healthy`.

```bash
docker compose -f compose.prod.yml logs migrate | tail -5   # "All migrations applied."
docker compose -f compose.prod.yml logs api | grep -i sync  # "Redis subscription ready"
```

Provision the single account:

```bash
docker compose -f compose.prod.yml exec api \
  node dist/db/provisionUser.js --production --email <YOUR_EMAIL> --password-stdin
```

## 9. Smoke test

```bash
curl -I https://planner.thiagobraga.dev
curl -s https://planner.thiagobraga.dev/api/v1/health   # {"status":"ok"}
```

In a browser: log in, create a task, complete it. Open a second tab and confirm
the change appears without a reload (that exercises Socket.IO end to end).

Check the box is coping, given 954MB RAM:

```bash
free -h
docker stats --no-stream
dmesg | grep -i -E 'oom|killed process'   # expect no output
```

---

## Rollback

Every image is tagged with its commit SHA, so redeploying a known-good build is:

```bash
cd /p/projects/planner
IMAGE_TAG=<previous-sha> docker compose -f compose.prod.yml up -d
```

## Notes

- `docker compose ... pull` needs the GHCR packages public, or a `docker login`.
- Backups land in `/p/projects/planner/backups/` on the same disk, so they do not
  survive loss of the VPS. Off-box copies are tracked as a fast-follow.
