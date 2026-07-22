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
ssh-keygen -t ed25519 -f ~/.ssh/planner_deploy -C "github-actions-planner-deploy" -N ""
```

Install the public half on the VPS:

```bash
ssh-copy-id -i ~/.ssh/planner_deploy.pub ubuntu@<VPS_IP>
```

Capture the host key so CI can pin it instead of blindly trusting on first
connect:

```bash
ssh-keyscan -t ed25519 <VPS_IP>
```

Verify the key works and is restricted to what you expect:

```bash
ssh -i ~/.ssh/planner_deploy ubuntu@<VPS_IP> 'echo OK; docker --version'
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

| Secret             | Value                                              |
| ------------------ | -------------------------------------------------- |
| `VPS_HOST`         | `<VPS_IP>`                                         |
| `VPS_SSH_USER`     | `ubuntu`                                           |
| `VPS_SSH_KEY`      | full contents of `~/.ssh/planner_deploy` (private)  |
| `VPS_SSH_HOST_KEY` | the `ssh-keyscan` output line from step 1           |

```bash
gh secret set VPS_SSH_KEY < ~/.ssh/planner_deploy
gh secret set VPS_HOST --body '<VPS_IP>'
gh secret set VPS_SSH_USER --body 'ubuntu'
ssh-keyscan -t ed25519 <VPS_IP> | gh secret set VPS_SSH_HOST_KEY
```

---

## 4. Clone the repo (VPS)

```bash
sudo mkdir -p /opt/planner
sudo chown ubuntu:ubuntu /opt/planner
git clone https://github.com/thiagobraga/planner.git /opt/planner
cd /opt/planner
```

## 5. Generate secrets (VPS)

**The runbook's existing snippet is wrong — do not use it.** It generates a
password inline inside `database_url` and never writes the same value to
`postgres_password`, so Postgres initialises with a different password than the
connection URL. Same for Redis. It also uses `openssl rand -base64`, whose `/`,
`+` and `=` characters corrupt a URL when they land in the password field.

Generate each password once, in hex, and reuse it:

```bash
cd /opt/planner
mkdir -p secrets
umask 077

PG_PASS=$(openssl rand -hex 24)
RD_PASS=$(openssl rand -hex 24)

printf '%s' 'planner'  > secrets/postgres_user
printf '%s' 'planner'  > secrets/postgres_db
printf '%s' "$PG_PASS" > secrets/postgres_password
printf '%s' "$RD_PASS" > secrets/redis_password

printf 'postgres://planner:%s@postgres:5432/planner' "$PG_PASS" > secrets/database_url
printf 'redis://:%s@redis:6379' "$RD_PASS" > secrets/redis_url

openssl rand -hex 32 > secrets/csrf_secret
openssl rand -hex 32 > secrets/backup_key

chmod 600 secrets/*
unset PG_PASS RD_PASS
```

Confirm the two passwords actually match their URLs before starting anything:

```bash
grep -q "$(cat secrets/postgres_password)" secrets/database_url && echo "postgres OK" || echo "POSTGRES MISMATCH"
grep -q "$(cat secrets/redis_password)"    secrets/redis_url    && echo "redis OK"    || echo "REDIS MISMATCH"
```

## 6. Environment (VPS)

```bash
echo 'CORS_ORIGIN=https://planner.thiagobraga.dev' > /opt/planner/.env
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
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
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
cd /opt/planner
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
cd /opt/planner
IMAGE_TAG=<previous-sha> docker compose -f compose.prod.yml up -d
```

## Notes

- `docker compose ... pull` needs the GHCR packages public, or a `docker login`.
- Backups land in `/opt/planner/backups/` on the same disk, so they do not
  survive loss of the VPS. Off-box copies are tracked as a fast-follow.
