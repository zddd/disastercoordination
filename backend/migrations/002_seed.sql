-- REQ-001 MVP Seed Data
-- Initial accounts for development and testing.
-- Run: psql -U dc_user -d dc_center < migrations/002_seed.sql
-- Or: go run cmd/seed/main.go (auto-runs on server start in dev mode)

-- ============================================================
-- Admin account (password: admin123)
-- ============================================================
INSERT INTO users (id, username, password_hash, display_name, role, credit_score, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2a$10$LmUJ0FG/n4FbL2akXeRLR.rrMcyWj68trG33yAKxocuIDhgJWsaxq',  -- bcrypt('admin123')
  '系统管理员',
  'admin',
  100.0,
  'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Commander account (password: 123456)
-- ============================================================
INSERT INTO users (id, username, password_hash, display_name, role, credit_score, status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'commander',
  '$2a$10$qbKEOcq3gr0bhKdS8A7XPOhlUSL.IEMspdGF2XqPFQrkyBIB5j5Z.',  -- bcrypt('123456')
  '张指挥',
  'commander',
  100.0,
  'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Reviewer account (password: 123456)
-- ============================================================
INSERT INTO users (id, username, password_hash, display_name, role, credit_score, status)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'reviewer',
  '$2a$10$qbKEOcq3gr0bhKdS8A7XPOhlUSL.IEMspdGF2XqPFQrkyBIB5j5Z.',
  '李审核',
  'reviewer',
  100.0,
  'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Rescue team accounts (password: 123456)
-- ============================================================
INSERT INTO users (id, username, password_hash, display_name, role, team_id, credit_score, status)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'bluesky',
  '$2a$10$GkuhmZizt50umv4vMbKM6ef0lj19QANXRiFTxOEl5vake7C41F.La',
  '蓝天救援队',
  'rescue_team',
  '00000000-0000-0000-0000-000000000010',  -- Links to rescue_teams(id)
  100.0,
  'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Victim account (password: 123456)
-- ============================================================
INSERT INTO users (id, username, password_hash, display_name, role, credit_score, status)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'victim1',
  '$2a$10$qbKEOcq3gr0bhKdS8A7XPOhlUSL.IEMspdGF2XqPFQrkyBIB5j5Z.',
  '王群众',
  'victim',
  100.0,
  'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Demo rescue team
-- ============================================================
INSERT INTO rescue_teams (id, name, type, capabilities, contact_phone, contact_person, member_count, status, verified)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '蓝天救援队',
  'registered',
  '{water,mountain,medical}',
  '13800001111',
  '张队长',
  35,
  'active',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO rescue_teams (id, name, type, capabilities, contact_phone, contact_person, member_count, status, verified)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '市民互助队',
  'civil',
  '{water}',
  '13800002222',
  '李队长',
  12,
  'active',
  true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo disaster (active)
-- ============================================================
INSERT INTO disasters (id, name, type, level, status, created_by, started_at)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '2026年泸定6.8级地震（演练）',
  'earthquake',
  'red',
  'active',
  '00000000-0000-0000-0000-000000000001',
  NOW()
) ON CONFLICT DO NOTHING;
