-- REQ-001 MVP Database Migration
-- Disaster Coordination System - Core Tables
-- PostgreSQL 16 + PostGIS 3.4
--
-- Design reference: design-001.md §4.1 MVP Data Model
-- All tables include disaster_id for future horizontal partitioning.
-- Full version extends with 11 additional tables (see §4.2).

-- ============================================================
-- Extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. disasters - Disaster event instances
-- ============================================================
CREATE TABLE disasters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    type          VARCHAR(50)  NOT NULL,  -- earthquake, flood, typhoon, epidemic, other
    level         VARCHAR(20)  NOT NULL DEFAULT 'general',  -- red, orange, yellow, blue, general
    description   TEXT,
    area_geom     GEOMETRY(POLYGON, 4326),  -- Affected area as geographic polygon
    status        VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active, closed, archived
    created_by    UUID         NOT NULL,
    started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. users - System users with RBAC
-- ============================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    display_name  VARCHAR(200),
    phone         VARCHAR(20),
    role          VARCHAR(30)  NOT NULL DEFAULT 'victim',  -- VARCHAR for extensibility
    -- Valid roles: admin, commander, zone_commander, reviewer, operator,
    --              rescue_team, volunteer, supply_manager, donor, victim
    team_id       UUID,
    credit_score  FLOAT        NOT NULL DEFAULT 100.0,
    status        VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active, suspended
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. help_requests - SOS / help submissions
-- ============================================================
-- Dual-coordinate strategy (design §3.5):
--   precise_geom: exact GPS, restricted to rescue_team(accepted)/commander/reviewer
--   offset_geom:   publicly visible, 50-200m random offset applied
CREATE TABLE help_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_id             UUID         NOT NULL REFERENCES disasters(id),
    submitter_id            UUID         REFERENCES users(id),  -- Nullable for unauthenticated
    category                VARCHAR(50)  NOT NULL,  -- trapped, injured, collapse, missing, etc.
    urgency                 VARCHAR(20)  NOT NULL DEFAULT 'normal',  -- critical, normal, mild
    description             TEXT         NOT NULL,
    affected_count          INT          NOT NULL DEFAULT 1,

    -- Dual-coordinate location
    precise_geom            GEOMETRY(POINT, 4326),  -- Exact location (access controlled)
    offset_geom             GEOMETRY(POINT, 4326),  -- Offset location (public)
    offset_meters           FLOAT        DEFAULT 0,  -- Actual random offset applied

    -- Contact info (visibility controlled by role)
    phone                   VARCHAR(20),
    contact_name            VARCHAR(100),

    -- Status flow: pending_review -> reviewed -> in_pool -> assigned -> completed
    status                  VARCHAR(30)  NOT NULL DEFAULT 'pending_review',
    review_status           VARCHAR(20)  DEFAULT 'pending',  -- pending, ai_flagged, approved, rejected, merged
    review_notes            TEXT,
    reviewed_by             UUID,
    reviewed_at             TIMESTAMPTZ,

    -- Quality & anti-fraud
    is_isolated_report      BOOLEAN      DEFAULT FALSE,
    submitter_credit_score  FLOAT,

    -- Archival
    is_archived             BOOLEAN      DEFAULT FALSE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. rescue_teams - Rescue organizations
-- ============================================================
CREATE TABLE rescue_teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(30)  NOT NULL DEFAULT 'civil',  -- registered (注册救援队) or civil (民间救援力量)
    capabilities    TEXT[]       NOT NULL DEFAULT '{}',  -- e.g., {water, mountain, medical, fire}
    contact_phone   VARCHAR(20)  NOT NULL,
    contact_person  VARCHAR(100),
    member_count    INT          DEFAULT 0,
    status          VARCHAR(20)  DEFAULT 'active',  -- active, inactive, suspended, pending
    verified        BOOLEAN      DEFAULT FALSE,
    current_location GEOMETRY(POINT, 4326),  -- Last known GPS position
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. rescue_tasks - Dispatch assignments
-- ============================================================
CREATE TABLE rescue_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    help_request_id UUID         NOT NULL REFERENCES help_requests(id),
    team_id         UUID         NOT NULL REFERENCES rescue_teams(id),
    disaster_id     UUID         NOT NULL REFERENCES disasters(id),  -- Partition key
    status          VARCHAR(30)  NOT NULL DEFAULT 'assigned',
    -- Status flow (state machine): assigned -> accepted -> en_route -> arrived -> rescuing -> completed
    --                                                                    -> unable  -> need_backup
    assigned_by     UUID         NOT NULL,  -- Commander who assigned
    status_history  JSONB        DEFAULT '[]',  -- [{status, timestamp, operator_id, notes}]
    notes           TEXT,
    accepted_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. help_attachments - Uploaded files (photos, videos, audio)
-- ============================================================
CREATE TABLE help_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    help_request_id UUID         NOT NULL REFERENCES help_requests(id),
    type            VARCHAR(20)  NOT NULL,  -- image, video, audio
    url             VARCHAR(500) NOT NULL,  -- MinIO or local path
    thumbnail_url   VARCHAR(500),
    file_size       BIGINT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. review_ai_flags - AI pre-screening results
-- ============================================================
CREATE TABLE review_ai_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    help_request_id UUID         NOT NULL REFERENCES help_requests(id),
    flag_type       VARCHAR(50)  NOT NULL,  -- duplicate, abnormal_coords, spam, sensitive
    confidence      FLOAT        NOT NULL,  -- 0.0 - 1.0
    detail          TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Spatial Indexes (PostGIS GIST)
-- ============================================================
CREATE INDEX idx_help_requests_offset_geom ON help_requests USING GIST (offset_geom);
CREATE INDEX idx_help_requests_precise_geom ON help_requests USING GIST (precise_geom);
CREATE INDEX idx_disasters_area_geom ON disasters USING GIST (area_geom);
CREATE INDEX idx_rescue_teams_location ON rescue_teams USING GIST (current_location);

-- ============================================================
-- Standard Indexes
-- ============================================================
-- Help requests: filtered by disaster + status
CREATE INDEX idx_help_requests_status ON help_requests (status, disaster_id, urgency);
CREATE INDEX idx_help_requests_disaster_urgency ON help_requests (disaster_id, urgency, created_at);

-- Rescue tasks: filtered by disaster + status
CREATE INDEX idx_rescue_tasks_status ON rescue_tasks (status, disaster_id);
CREATE INDEX idx_rescue_tasks_team ON rescue_tasks (team_id, status);

-- Users: lookup by username
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_role ON users (role);

-- Attachments: lookup by help request
CREATE INDEX idx_attachments_help ON help_attachments (help_request_id);

-- AI flags: lookup by help request
CREATE INDEX idx_ai_flags_help ON review_ai_flags (help_request_id);
