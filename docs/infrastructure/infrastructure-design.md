# Infrastructure Design — Docker & AWS

> Phase 8 · Status: Draft v0.1 · 2026-05-30 · Strategy: local-first, cloud-ready

## 1. Docker architecture (local / single-host)
```mermaid
graph TB
    subgraph host[Docker Compose host]
      dash[dashboard]
      api[api]
      orch[orchestrator-worker]
      pg[(postgres+pgvector)]
      rd[(redis)]
      mcp[mcp-servers]
      pw[playwright-runner]
      prom[prometheus]
      graf[grafana]
      loki[loki/logging]
    end
    dash-->api-->orch
    orch-->mcp
    orch-->pg
    orch-->rd
    mcp-->pw
    prom-->api
    prom-->orch
    graf-->prom
    graf-->loki
```
- **Services:** `dashboard` (Next.js), `api`, `orchestrator-worker` (LangGraph + BullMQ
  consumers), `postgres` (pgvector image), `redis`, `mcp-servers` (one or a few containers),
  `playwright-runner` (isolated), plus optional `prometheus`/`grafana`/`loki`.
- **Images:** multi-stage Node 20 Alpine; non-root user; pinned digests.
- **Volumes:** `pgdata`, `objstore` (or MinIO for S3-compatible local), `secrets`.
- **Networking:** internal bridge network; only `dashboard` exposed to localhost.
- **One command:** `docker compose up` brings the whole system up locally.

## 2. AWS architecture (cloud path)
```mermaid
graph TB
    subgraph aws[AWS VPC]
      alb[ALB + ACM TLS]
      subgraph ecs[ECS Fargate]
        sdash[dashboard task]
        sapi[api task]
        sworker[worker/orchestrator task]
        smcp[mcp tasks]
      end
      rds[(RDS Postgres + pgvector)]
      ec[(ElastiCache Redis)]
      s3[(S3 objects)]
      sm[Secrets Manager + KMS]
      cw[CloudWatch + alarms]
    end
    alb-->sdash
    alb-->sapi
    sapi-->sworker
    sworker-->smcp
    sworker-->rds
    sworker-->ec
    smcp-->s3
    ecs-->sm
    ecs-->cw
```
- **Compute:** ECS Fargate services (dashboard/api/worker/mcp). Autoscale worker on queue depth.
- **Data:** RDS PostgreSQL (pgvector) Multi-AZ optional; ElastiCache Redis; S3 (encrypted).
- **Secrets:** Secrets Manager/SSM + KMS.
- **Edge:** ALB + ACM TLS; WAF optional; dashboard behind auth.
- **Cost control:** smallest viable instances; scale-to-zero workers when idle; budget alarms.

## 3. Environments
| Env | Purpose | Infra |
|-----|---------|-------|
| local | dev + primary run | Docker Compose |
| staging (optional) | pre-prod validation | minimal ECS or a VPS |
| prod | live use | Docker Compose on VPS **or** AWS ECS |

## 4. Configuration & parity
- 12-factor: all config via env/secrets; same images across envs.
- `compose` (local) and `ecs task defs` (cloud) consume the same container images.
