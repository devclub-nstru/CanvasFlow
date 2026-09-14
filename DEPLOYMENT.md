# Deploying CanvasFlow on EC2 with Docker

Everything the application needs runs as containers on a single EC2 instance:
Postgres, Redis and MongoDB alongside the five application processes. TLS and
routing are **not** in here — nginx on the host handles those, and the
containers publish on `127.0.0.1` for it to proxy to.

```
                          nginx (host, not compose)
                                    │
              ┌─────────────────────┼─────────────────────┐
        127.0.0.1:3000        127.0.0.1:8000        127.0.0.1:8080
              │                     │                     │
        ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐   ┌──────────────┐
        │    web    │         │    api    │         │   menti   │   │ menti-worker │
        └───────────┘         └─────┬─────┘         └─────┬─────┘   └──────┬───────┘
                                    │  ┌────────┐         │                │
                                    ├──┤ worker │         │                │  LibreOffice
                                    │  └────────┘         │                │  + poppler
                        ┌───────────┴──────┬──────────────┴────────┬───────┘
                   ┌────▼─────┐      ┌─────▼─────┐          ┌──────▼──────┐
                   │ postgres │      │   redis   │          │    mongo    │
                   └──────────┘      └───────────┘          └─────────────┘
```

The three datastores publish no ports at all — they are reachable only over
the compose network, by service name.

---

## 1. The instance

|            |                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Type       | **t3.large** (2 vCPU / 8 GB) — a t3.medium runs it, but LibreOffice converting a deck alongside a live room is what pushes it over |
| Storage    | 30 GB gp3                                                                                                                          |
| AMI        | Ubuntu 24.04 LTS                                                                                                                   |
| Elastic IP | Yes — DNS points at it, and a stop/start would otherwise change the address                                                        |

Security group inbound: **22** from your IP, **80** and **443** from anywhere
(nginx). Nothing else — in particular never 5432, 6379 or 27017, and not 3000 /
8000 / 8080 either, since those are bound to loopback and only nginx needs them.

## 2. Install Docker

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
```

Add swap if you chose a smaller instance — an OOM-killed Next.js build looks
like a random failure:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Configure the deploy directory

Images are built in CI and pushed to Docker Hub — the instance never clones
the repo or runs a build. It only needs `docker-compose.prod.yml` and `.env`
in place, both of which the CI/CD workflow copies in on every deploy (see
§8). To set the directory up by hand the first time:

```bash
mkdir -p ~/projects/CanvasFlow && cd ~/projects/CanvasFlow
```

Copy `docker-compose.prod.yml` from the repo onto the instance (scp, or paste
it directly), and create `.env` there.

Generate secrets:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
```

Then edit `.env`. **The connection URLs must use compose service names, not
`localhost`** — inside a container `localhost` is that container itself, and
this is the most common way this deploy fails:

```dotenv
NODE_ENV=production

BASE_URL=https://api.example.com
WEB_URL=https://app.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_MENTI_API_URL=https://menti.example.com

JWT_SECRET=<generated>

POSTGRES_USER=postgres
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=canvasflow
DATABASE_URL=postgresql://postgres:<generated>@postgres:5432/canvasflow

REDIS_PASSWORD=<generated>
REDIS_URL=redis://:<generated>@redis:6379

MONGO_USER=menti
MONGO_PASSWORD=<generated>
MONGO_DB=menti
MONGO_URI=mongodb://menti:<generated>@mongo:27017/menti?authSource=admin

UPLOAD_TMP_DIR=/var/tmp/canvasflow-uploads

# Resolves the image: line in docker-compose.prod.yml — must match the
# Docker Hub account CI pushes to.
DOCKERHUB_USERNAME=<your dockerhub username>
IMAGE_TAG=latest
```

The `tr -d '/+='` above is not cosmetic: those characters are URL syntax and
would have to be percent-encoded inside `DATABASE_URL` and friends.

`setup.sh` and the per-workspace `.env` symlinks are a source-tree concern —
skip them here, there is no source tree on this box.

If you plan to run the monitoring overlay (§10), the deploy workflow also
copies `docker-compose.monitoring.yml` and the `monitoring/` directory into
this same directory. Nothing to do by hand.

## 4. Log in to Docker Hub and start

```bash
docker login -u <your dockerhub username>
docker compose -f docker-compose.prod.yml config -q
docker compose -f docker-compose.prod.yml pull api worker web migrate menti menti-worker
docker compose -f docker-compose.prod.yml up -d --wait postgres redis mongo
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d --wait api worker web menti
docker compose -f docker-compose.prod.yml up -d menti-worker
docker compose -f docker-compose.prod.yml ps
```

From the instance itself, before nginx is in front:

```bash
curl -fsS http://127.0.0.1:8000/ready && echo
curl -fsS http://127.0.0.1:8080/health/ready && echo
curl -fsSI http://127.0.0.1:3000 | head -1
```

### Rebuilding the web image

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_MENTI_API_URL` are compiled into the
browser bundle, not read at runtime — the `web` target's Dockerfile build args
carry them in for that reason. Since the image is built in CI (see §8), the
values must be correct in the `ENV` secret *before* pushing to `main`, and CI
pulls them from there — changing them in the server's `.env` alone does
nothing; the image was already baked with whatever the secret held at build
time. A deployed page calling `http://localhost:8000` from the user's browser
means the `ENV` secret was stale when that image was built — fix the secret
and push again (or re-run the workflow) to rebuild `web`.

## 5. nginx

nginx is yours to configure; what follows is only the shape the app requires.

**TLS is not optional.** The session cookie is minted with `secure: true` and
`SameSite=None` ([auth.ts:687](packages/trpc/server/auth.ts:687)), and browsers
discard a Secure cookie delivered over plain `http://`. Served without a
certificate the site loads, looks fine, and login silently never persists.

Three server blocks, one per origin:

```nginx
server {                      # app.example.com  ->  web
    listen 443 ssl http2;
    server_name app.example.com;
    # ssl_certificate ... (certbot)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {                      # api.example.com  ->  api
    listen 443 ssl http2;
    server_name api.example.com;

    # File uploads are capped in the app by UPLOAD_MAX_MB_VIDEO (100 MB by
    # default). nginx's own default is 1 MB, and it rejects the request before
    # the app ever sees it — so this has to be at least as large.
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {                      # menti.example.com  ->  menti
    listen 443 ssl http2;
    server_name menti.example.com;

    client_max_body_size 100m;          # PowerPoint imports

    location / {
        proxy_pass http://127.0.0.1:8080;

        # Socket.IO. Without these three lines the upgrade fails, the client
        # silently falls back to HTTP long-polling, and a 1000-participant room
        # turns into a request storm.
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # A live room holds an idle socket open between slides; the 60s default
        # would cut it and force a reconnect.
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Four things the app depends on, whatever else you change:

1. **`X-Forwarded-For`.** Both servers run `trust proxy: 1`. Without the header
   every request appears to come from the proxy, and one rate-limit bucket is
   shared by all users.
2. **`X-Forwarded-Proto: https`,** or redirect links and cookies come out wrong.
3. **The WebSocket upgrade headers** on the Menti block.
4. **`client_max_body_size`** raised on the api and menti blocks.

A fourth block, only if the monitoring overlay is running (see section 10):

```nginx
server {                      # grafana.example.com  ->  grafana
    listen 443 ssl http2;
    server_name grafana.example.com;

    location / {
        # 3001, not 3000: web already owns 3000 on loopback, so Grafana's
        # container port 3000 is published one higher.
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Grafana Live streams dashboard updates over a WebSocket, same as
        # Menti. Without these the dashboards still work but never refresh
        # themselves.
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Grafana is the only monitoring service that is ever proxied. Prometheus and the
exporters publish no ports at all — `/metrics` is unauthenticated and describes
the internals of each service.

Certificates with certbot: `sudo certbot --nginx -d app.example.com -d
api.example.com -d menti.example.com`. It installs a renewal timer itself.

## 6. Databases

The three datastores are ordinary containers with named volumes
(`pg_data_prod`, `redis_data_prod`, `mongo_data_prod`), so they survive
`docker compose down` and every redeploy. `down -v` destroys them; do not use
it on this host.

Redis runs with `--requirepass` and `--appendonly yes` — it backs BullMQ, and a
queue that loses its jobs on restart loses uploads with them.

The point where a single instance stops being the right answer is backups and
failover, not throughput. Moving Postgres to RDS later is a `DATABASE_URL`
change and nothing else; likewise Mongo → Atlas, Redis → ElastiCache. Until
then, get backups off the box:

```bash
# /etc/cron.daily/canvasflow-backup  (chmod +x)
set -euo pipefail
cd /home/ubuntu/projects/CanvasFlow
STAMP=$(date +%F)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres canvasflow | gzip > /tmp/pg-$STAMP.sql.gz
docker compose -f docker-compose.prod.yml exec -T mongo \
  mongodump --archive --gzip -u menti -p "$MONGO_PASSWORD" --authenticationDatabase admin > /tmp/mongo-$STAMP.gz
aws s3 cp /tmp/pg-$STAMP.sql.gz s3://your-backup-bucket/postgres/
aws s3 cp /tmp/mongo-$STAMP.gz  s3://your-backup-bucket/mongo/
rm -f /tmp/pg-$STAMP.sql.gz /tmp/mongo-$STAMP.gz
```

Give the instance an IAM role with write access to that bucket rather than
putting AWS keys in `.env`.

## 7. Mail

`packages/services/mail` speaks SMTP. There is no vendor SDK and no API key —
changing provider is a change to `.env` and nothing else.

**Do not run a mail server on the instance.** AWS blocks outbound port 25 on
EC2 by default, and mail from an EC2 address is distrusted by large receivers
even after the limit is lifted. The relay has to be somebody else's, reached on
587 or 465, neither of which is blocked.

Either a single URL:

```dotenv
SMTP_URL=smtp://AKIA...:BNx...@email-smtp.eu-west-1.amazonaws.com:587
MAIL_FROM=CanvasFlow <noreply@example.com>
```

or the discrete fields, which avoid having to percent-encode `@ : /` in a
password:

```dotenv
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASSWORD=BNx...
MAIL_FROM=CanvasFlow <noreply@example.com>
```

`SMTP_SECURE` is derived from the port — 465 is implicit TLS, anything else
starts plaintext and upgrades with STARTTLS. Getting that backwards is the
usual cause of a send that hangs until the connect timeout fires.

| Relay                          | Host / port                             | Notes                                                                                                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Amazon SES**                 | `email-smtp.<region>.amazonaws.com:587` | The natural fit on EC2. Credentials are generated in the SES console — they are _not_ your AWS access keys. Requires leaving the SES sandbox (a support request, ~1 day) before you can mail an unverified address.                                                                |
| **Brevo / Mailgun / Postmark** | provider's host `:587`                  | Generous free tiers; same DKIM/SPF verification work.                                                                                                                                                                                                                              |
| **Gmail**                      | `smtp.gmail.com:465`                    | Needs 2FA plus an [app password](https://myaccount.google.com/apppasswords) — the account password is rejected. ~500/day. This is the one case where `MAIL_FROM` at `gmail.com` is correct, and the sender check knows to stay quiet when the relay is that provider's own server. |

Then:

1. **`MAIL_FROM` must be at a domain the relay may send for** — one whose DNS
   publishes the relay's DKIM and SPF records. Otherwise every message is
   rejected with a domain-not-verified error; the code says so at boot rather
   than letting you discover it from a 550.
2. **`BASE_URL` and `WEB_URL` must be the real https origins.** The
   confirmation link is built from `BASE_URL` and the reset link from
   `WEB_URL`; a leftover `localhost` sends fine and is useless when opened.
3. **Restart `api` and `worker`**, then sign up with a real address and watch
   the log. Boot prints `[mail] smtp relay: <host>, sender: <from>`, so a
   misconfiguration shows up immediately.

With no relay configured the app still runs — every message goes to the API log
instead, and in production that is logged as an error rather than silently.
Fine for a first smoke test, not for real users.

## 8. Automated deploys

`.github/workflows/ci-cd.yml` builds and deploys on every push to `main`, in
two stages:

1. **`build-and-push`** — builds all six targets (`api`, `worker`, `web`,
   `migrate`, `menti`, `menti-worker`) and pushes each to Docker Hub as
   `<DOCKERHUB_USERNAME>/canvasflow-<target>`, tagged both `:latest` and
   `:<git sha>`. The `web` build's `NEXT_PUBLIC_*` args are read out of the
   `ENV` secret at this point — see the note in §3.
2. **`deploy`** — SCPs `docker-compose.prod.yml`,
   `docker-compose.monitoring.yml` and the `monitoring/` directory onto the
   instance (the instance holds no source checkout), SSHes in, writes `.env`
   from the `ENV` secret plus `DOCKERHUB_USERNAME`/`IMAGE_TAG`, logs in to
   Docker Hub, pulls the images tagged with the current commit SHA, runs
   migrations, restarts the app services, brings the monitoring overlay up if
   it is configured (§10), and removes the image IDs that were replaced.

   The monitoring step runs last and cannot fail the deploy: the application
   is already healthy by then, and it is skipped outright when the `ENV`
   secret carries no `GRAFANA_ROOT_URL`.

nginx is untouched by it, which is one advantage of keeping the proxy on the
host. Six repository secrets:

| Secret               | Value                                                             |
| -------------------- | ------------------------------------------------------------------ |
| `SSH_HOST`            | the Elastic IP                                                    |
| `SSH_USER`            | `ubuntu`                                                          |
| `SSH_PASSWORD`        | password for that user                                            |
| `ENV`                 | the entire contents of `.env` — including the monitoring values from §10, since this file is overwritten from the secret on every deploy |
| `DOCKERHUB_USERNAME`  | Docker Hub username/org images are pushed to and pulled from      |
| `DOCKERHUB_TOKEN`     | Docker Hub access token (Account Settings → Security), not the account password |

Two things to fix before relying on it long-term. It authenticates with a
password, which means enabling `PasswordAuthentication` on an
internet-facing box — switch to a deploy key (`appleboy/ssh-action` and
`appleboy/scp-action` both take `key:`) and use an `SSH_KEY` secret instead.
And rollback today means re-running the workflow for an older commit (or
manually setting `IMAGE_TAG` in the server's `.env` to a previous SHA and
re-running the `pull`/`up -d` steps by hand) — there is no one-click revert.

## 9. Day to day

```bash
cd ~/projects/CanvasFlow

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f menti
docker compose -f docker-compose.prod.yml restart api

# psql / mongosh, without exposing either port
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d canvasflow
docker compose -f docker-compose.prod.yml exec mongo mongosh -u menti -p --authenticationDatabase admin

# reclaim disk after a few deploys
docker image prune -f
```

Containers log with `json-file` capped at 10 MB × 3 per service, so logs cannot
fill the disk. Images can — hence the prune, which the workflow also runs.


## 10. Monitoring (optional)

Prometheus, Grafana, `postgres_exporter` and `node_exporter`, as an overlay on
the production stack. Roughly 450 MB of RAM and under 1 GB of disk at the
configured 15-day retention.

**The deploy workflow starts it for you.** §8 copies
`docker-compose.monitoring.yml` and the whole `monitoring/` directory to the
instance alongside `docker-compose.prod.yml`, then brings the four services up
after the application is healthy. Dashboards therefore live in version control
rather than drifting on the box.

It is skipped, with a line in the deploy log saying so, unless both
`GRAFANA_ROOT_URL` and `POSTGRES_EXPORTER_DSN` are present in the `ENV` secret.
A host that cannot spare the memory simply runs without it — there is no
separate branch and no edited compose file. And if the stack fails to start,
the deploy logs a warning and still succeeds: the application is already
serving traffic by that point, and Grafana is not worth rolling it back for.

Three things have to be done once, by hand, before the first deploy that
includes it.

**1. The read-only database role.** Grafana and `postgres_exporter` share it,
and it must not be able to write:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d canvasflow
```

```sql
CREATE ROLE grafana_ro LOGIN PASSWORD '<generate one>';
GRANT CONNECT ON DATABASE canvasflow TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
GRANT pg_monitor TO grafana_ro;
```

`ALTER DEFAULT PRIVILEGES` is the line people skip. Without it the next
migration creates a table Grafana cannot read, and a panel quietly empties.

**2. The environment.** These go in the **`ENV` repository secret**, not in the
`.env` on the instance — §8 overwrites that file from the secret on every
deploy, so anything edited by hand there disappears at the next push:

```dotenv
METRICS_ENABLED=true
METRICS_PORT=
METRICS_QUEUE_POLL_MS=15000

GRAFANA_ROOT_URL=https://grafana.example.com
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<generate one>

GRAFANA_DB_HOST=postgres:5432
GRAFANA_DB_NAME=canvasflow
GRAFANA_DB_USER=grafana_ro
GRAFANA_DB_PASSWORD=<the role password>

POSTGRES_EXPORTER_DSN=postgresql://grafana_ro:<the role password>@postgres:5432/canvasflow?sslmode=disable
```

`METRICS_PORT` is deliberately blank. The API and the worker read the same
file, so one value here would point both at the same port and the second to
start could not bind it. Their defaults already differ — 9464 and 9465.

**3. DNS and nginx.** An A record for `grafana.<domain>`, the fourth server
block from §5, and a certificate:

```bash
sudo certbot --nginx -d grafana.example.com
```

Grafana is the only monitoring service that is ever proxied. Prometheus and
both exporters publish no ports at all: `/metrics` is unauthenticated
everywhere, and a reachable Prometheus is a full read of the internal topology.
To look at it, tunnel instead:

```bash
ssh -L 9090:127.0.0.1:9090 your-host
```

### Checking it

The deploy log prints the scrape targets after starting the stack. To check by
hand:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml exec prometheus wget -qO- 'http://127.0.0.1:9090/api/v1/targets?state=active'
```

All four — api, worker, postgres, node — should read `"health":"up"`. Both `-f`
flags are required on every monitoring command: the overlay has to join the
same compose project, or Prometheus cannot resolve `api:9464`.

Three dashboards are provisioned automatically: service health, infrastructure,
and product. Details and the full metric list are in
[monitoring/README.md](monitoring/README.md).

The API serves metrics on `METRICS_PORT` (9464) rather than on 8000, and the
worker on 9465 — neither should be proxied. If `CLUSTER_WORKERS` is greater
than 1, that port is bound by the cluster primary, which aggregates its forks;
a scrape of a cluster-shared port would silently report a fraction of every
counter.
