-- Autonomous AI Job Search Agent — PostgreSQL schema (reference)
-- Phase 6 · Draft v0.1 · PostgreSQL 16 + pgvector
-- This is design-reference DDL; the canonical schema will live in packages/db (Prisma)
-- and be applied via migrations. Embedding dimension is a placeholder (set to your model).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()

-- ---------- Profile ----------
CREATE TABLE profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  headline      TEXT,
  contact       JSONB NOT NULL DEFAULT '{}',     -- email, phone, links
  data          JSONB NOT NULL,                  -- structured facts: skills, experience, projects, education
  version       INT  NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profile_chunk (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,                      -- experience|project|skill|summary|education
  ref_id      TEXT NOT NULL,                      -- stable citation id used for grounding
  content     TEXT NOT NULL,
  embedding   vector(1536),                       -- set to your embedding model dim
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Sources & Jobs ----------
CREATE TABLE source (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,              -- 'greenhouse', 'lever', 'rss:...'
  enabled      BOOLEAN NOT NULL DEFAULT false,
  automation_enabled BOOLEAN NOT NULL DEFAULT false,
  rate_rps     NUMERIC NOT NULL DEFAULT 1,
  config       JSONB NOT NULL DEFAULT '{}',
  cursor       TEXT,
  last_run_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key TEXT UNIQUE NOT NULL,             -- sha256(title|company|location)
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT,
  remote        BOOLEAN,
  description   TEXT,
  comp_min      INT,
  comp_max      INT,
  posted_at     TIMESTAMPTZ,
  raw_ref       TEXT,                             -- pointer to retained raw payload
  status        TEXT NOT NULL DEFAULT 'discovered', -- discovered|matched|archived
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_source (
  job_id        UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  source_id     UUID NOT NULL REFERENCES source(id),
  source_job_id TEXT NOT NULL,
  url           TEXT,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_job_id)
);

CREATE TABLE job_embedding (
  job_id     UUID PRIMARY KEY REFERENCES job(id) ON DELETE CASCADE,
  embedding  vector(1536)
);

-- ---------- Matching ----------
CREATE TABLE match (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL UNIQUE REFERENCES job(id) ON DELETE CASCADE,
  score       INT  NOT NULL CHECK (score BETWEEN 0 AND 100),
  subscores   JSONB NOT NULL DEFAULT '{}',
  confidence  NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  rationale   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Applications & Opportunities ----------
CREATE TABLE application (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES job(id),
  state         TEXT NOT NULL DEFAULT 'materials_drafted',
  normalized_role TEXT NOT NULL,
  company_key   TEXT NOT NULL,
  idempotency_key TEXT,
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_key, normalized_role)           -- no double-apply
);

CREATE TABLE opportunity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES application(id) ON DELETE CASCADE,
  state         TEXT NOT NULL DEFAULT 'applied',
  last_activity_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE material (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES application(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                    -- resume|cover_letter
  version       INT NOT NULL DEFAULT 1,
  is_current    BOOLEAN NOT NULL DEFAULT true,
  content       TEXT NOT NULL,
  file_ref      TEXT,                             -- rendered PDF in object store
  claims        JSONB NOT NULL DEFAULT '[]',      -- [{claim, profileRef}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE material_embedding (
  material_id UUID PRIMARY KEY REFERENCES material(id) ON DELETE CASCADE,
  embedding   vector(1536)
);

-- ---------- Messages, Events ----------
CREATE TABLE message (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunity(id) ON DELETE CASCADE,
  gmail_message_id TEXT UNIQUE NOT NULL,
  thread_id     TEXT NOT NULL,
  direction     TEXT NOT NULL,                    -- inbound|outbound
  label         TEXT,                             -- recruiter|invite|rejection|offer|info|other
  from_addr     TEXT, to_addr TEXT, subject TEXT,
  snippet       TEXT,
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_cal (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunity(id) ON DELETE CASCADE,
  google_event_id TEXT UNIQUE,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  tz            TEXT NOT NULL,
  link          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Approvals & Audit ----------
CREATE TABLE approval (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,                    -- apply|reply|schedule
  application_id UUID REFERENCES application(id),
  message_id    UUID REFERENCES message(id),
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|granted|rejected|expired
  decided_by    TEXT,                             -- 'operator'
  decided_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,                    -- application.submitted, reply.sent, event.created
  opportunity_id UUID,
  approval_id   UUID REFERENCES approval(id),
  payload_hash  TEXT NOT NULL,                    -- sha256 of payload
  prev_hash     TEXT,                             -- hash chain
  entry_hash    TEXT NOT NULL                     -- sha256(prev_hash || payload_hash || ...)
);

-- ---------- Outcomes & Learning ----------
CREATE TABLE outcome (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunity(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                    -- response|interview|offer|rejection|ghosted
  features      JSONB NOT NULL DEFAULT '{}',
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learning_param (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                    -- e.g. 'match.weights'
  version       INT NOT NULL,
  value         JSONB NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- ---------- Events & Config ----------
CREATE TABLE domain_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  opportunity_id UUID,
  actor         TEXT NOT NULL,
  payload       JSONB NOT NULL,
  trace_id      TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE config (
  key           TEXT PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recruiter-reply drafts (FR-604): grounded replies awaiting human approval in the dashboard
-- inbox. One row per source recruiter message; sending requires an explicit operator click and
-- re-passing the FR-605 reply-target guard.
CREATE TABLE reply_draft (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_gmail_id   TEXT NOT NULL UNIQUE,
  thread_id         TEXT NOT NULL,
  from_addr         TEXT NOT NULL,         -- recruiter (who we reply to)
  to_addr           TEXT NOT NULL,         -- normalized recruiter email
  recruiter_subject TEXT,
  label             TEXT NOT NULL,         -- classifier label (interview_invite, offer, …)
  subject           TEXT NOT NULL,         -- our reply subject
  body              TEXT NOT NULL,
  proposed_slots    JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | rejected
  sent_gmail_id     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at        TIMESTAMPTZ
);
CREATE INDEX reply_draft_status_idx ON reply_draft(status, created_at);
