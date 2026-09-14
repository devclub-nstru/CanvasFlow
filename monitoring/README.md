# Monitoring

Prometheus, Grafana, `postgres_exporter` and `node_exporter`, as an overlay on
the production stack.

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

Locally it is a script, against a separate compose file that reaches the host
processes rather than compose services:

```bash
pnpm monitor:up        # http://localhost:3001, anonymous admin
pnpm monitor:targets   # which targets are up, and why the others are not
pnpm monitor:down
```

Roughly 300–450 MB of RAM and under 1 GB of disk at the configured 15-day
retention. Leave the overlay out of the command and the product runs exactly as
before, with metrics collected by nobody — nothing in `apps/` depends on
anything here.

## What answers what

Two datasources, because the questions have two shapes.

**Prometheus** answers rates, latency, errors and resource use — the things you
would alert on. Scraped every 15s from four targets, none of which publish a
port to the host.

**Postgres** answers how many people signed up and how many were active in the
last 30 days. Distinct-users-over-a-window cannot be derived from counters at
all, so those panels are plain SQL against the application database through a
read-only role.

## Setup

### 1. The read-only database role

Grafana and `postgres_exporter` share one role. It must not be able to write.

```sql
CREATE ROLE grafana_ro LOGIN PASSWORD 'choose-a-strong-one';
GRANT CONNECT ON DATABASE canvasflow TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;

-- pg_stat_* views for the exporter. Not superuser.
GRANT pg_monitor TO grafana_ro;
```

`ALTER DEFAULT PRIVILEGES` is the line people skip: without it the next
migration creates a table Grafana cannot read, and a panel silently empties.

### 2. Environment

Set `GRAFANA_ROOT_URL`, `GRAFANA_ADMIN_PASSWORD`, `GRAFANA_DB_*` and
`POSTGRES_EXPORTER_DSN` in `.env` — all documented in `.env.example`.

### 3. nginx

One more server block, proxying `grafana.<domain>` to `127.0.0.1:3001`. See
[DEPLOYMENT.md](../DEPLOYMENT.md#10-monitoring-optional).

Note the port: `web` already owns 3000 on loopback, so Grafana's container port
3000 is published as 3001.

## Reaching Prometheus

It has no published port and no authentication of its own. A reachable
Prometheus is a full read of the internal topology, so it is never proxied.

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml exec prometheus \
  wget -qO- 'http://127.0.0.1:9090/api/v1/targets?state=active'
```

Or forward it for the duration of a debugging session:

```bash
ssh -L 9090:127.0.0.1:9090 your-host
```

## Where the numbers come from

| Dashboard      | Source                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Service health | API `/metrics` — request histogram, submissions, mail, rate limiting      |
| Infrastructure | process metrics from API and worker, `node_exporter`, `postgres_exporter` |
| Product        | SQL against `users`, `sessions`, `forms`, `form_submissions`              |

Application metrics are defined in one place, `packages/observability/metrics.ts`,
and imported by whichever service records them. Two services spelling the same
metric differently is how a dashboard ends up showing half the traffic.

## Things worth knowing before they surprise you

**Metrics are on their own port.** The API serves them on `METRICS_PORT`
(9464), not on 8000; the worker on 9465. `/metrics` is unauthenticated and
describes the service's internals, so nothing should ever proxy those ports.

**Clustering changes where metrics come from.** When `CLUSTER_WORKERS > 1` the
API forks, and a port shared by cluster workers is load-balanced across them —
a scrape would reach one arbitrary fork and report a fraction of every counter.
The primary aggregates the forks over IPC instead. This is automatic, but it is
why the metrics port is separate from the application port.

**Route labels are templates.** `/api/forms/:id`, never the real id. See
`packages/observability/route.ts`; the tests there are the actual specification.

**Histogram buckets are permanent.** Changing `LATENCY_BUCKETS` does not
re-bucket history, it discards it. Decide once.

**`METRICS_ENABLED=false`** turns all of it off without a redeploy.

## Alerting

Not configured. Grafana's alerting is built in, so it can be turned on later
without adding a container. The conditions worth starting with are 5xx rate
above 2% over 5m, p95 above 1s, `pg_up` at 0, disk above 85%, and any
`canvasflow_mail_total{result="failed"}` at all.
