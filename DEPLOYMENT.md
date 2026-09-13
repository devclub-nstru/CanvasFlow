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

## 3. Clone and configure

```bash
mkdir -p ~/projects && cd ~/projects
git clone <your-repo-url> CanvasFlow && cd CanvasFlow
cp .env.example .env
```

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
```

The `tr -d '/+='` above is not cosmetic: those characters are URL syntax and
would have to be percent-encoded inside `DATABASE_URL` and friends.

Then hard-link the env file into every workspace:

```bash
chmod +x setup.sh && ./setup.sh
```

## 4. Build and start

```bash
docker compose -f docker-compose.prod.yml config -q
docker compose -f docker-compose.prod.yml up -d --wait postgres redis mongo
docker compose -f docker-compose.prod.yml build api worker web migrate menti menti-worker
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
browser bundle, not read at runtime — `docker-compose.prod.yml` passes them as
build args for that reason. Changing either in `.env` does nothing until you
`build web` again. A deployed page calling `http://localhost:8000` from the
user's browser is always this.

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

`.github/workflows/ci-cd.yml` already does all of the above on every push to
`main`: it SSHes in, resets to `origin/main`, writes `.env` from the `ENV`
secret, rebuilds, migrates and restarts. nginx is untouched by it, which is
one advantage of keeping the proxy on the host. Four repository secrets:

| Secret         | Value                         |
| -------------- | ----------------------------- |
| `SSH_HOST`     | the Elastic IP                |
| `SSH_USER`     | `ubuntu`                      |
| `SSH_PASSWORD` | password for that user        |
| `ENV`          | the entire contents of `.env` |

Two things to fix before relying on it. It authenticates with a password, which
means enabling `PasswordAuthentication` on an internet-facing box — switch to a
deploy key (`appleboy/ssh-action` takes `key:`) and use an `SSH_KEY` secret
instead. And there is no rollback: `git reset --hard origin/main` plus a
rebuild means a bad commit is live until the next one. Tagging images per
commit, so you can `up -d --no-build` back onto the previous one, is the cheap
version of that.

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
