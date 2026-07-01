-- Cloudflare Worker edition schema.
-- D1 stores structured metadata only. Attachment binaries must live in R2.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_setting (
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS "user" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')) DEFAULT 'USER',
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_role_status ON "user"(role, row_status);
CREATE INDEX IF NOT EXISTS idx_user_created_ts ON "user"(created_ts, id);

CREATE TABLE IF NOT EXISTS user_setting (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS memo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE')) DEFAULT 'PRIVATE',
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memo_creator_status_created ON memo(creator_id, row_status, created_ts, id);
CREATE INDEX IF NOT EXISTS idx_memo_visibility_status_created ON memo(visibility, row_status, created_ts, id);
CREATE INDEX IF NOT EXISTS idx_memo_status_created ON memo(row_status, created_ts, id);

CREATE TABLE IF NOT EXISTS memo_relation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL,
  related_memo_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  created_ts INTEGER NOT NULL,
  UNIQUE(memo_id, related_memo_id, type)
);

CREATE INDEX IF NOT EXISTS idx_memo_relation_memo ON memo_relation(memo_id, type);
CREATE INDEX IF NOT EXISTS idx_memo_relation_related ON memo_relation(related_memo_id, type);

CREATE TABLE IF NOT EXISTS attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  memo_id INTEGER,
  filename TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  r2_bucket TEXT NOT NULL DEFAULT '',
  sha256 TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachment_creator_created ON attachment(creator_id, created_ts, id);
CREATE INDEX IF NOT EXISTS idx_attachment_memo ON attachment(memo_id, created_ts, id);
CREATE INDEX IF NOT EXISTS idx_attachment_r2_key ON attachment(r2_key);

CREATE TABLE IF NOT EXISTS reaction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  memo_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  created_ts INTEGER NOT NULL,
  UNIQUE(creator_id, memo_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reaction_memo ON reaction(memo_id, type);

CREATE TABLE IF NOT EXISTS memo_share (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  share_id TEXT NOT NULL UNIQUE,
  expires_ts INTEGER,
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memo_share_memo ON memo_share(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_share_creator ON memo_share(creator_id, created_ts, id);

CREATE TABLE IF NOT EXISTS inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UNREAD', 'READ', 'ARCHIVED')) DEFAULT 'UNREAD',
  message_json TEXT NOT NULL DEFAULT '{}',
  created_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_receiver_status_created ON inbox(receiver_id, status, created_ts, id);

CREATE TABLE IF NOT EXISTS shortcut (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  filter_json TEXT NOT NULL DEFAULT '{}',
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shortcut_creator_created ON shortcut(creator_id, created_ts, id);

CREATE TABLE IF NOT EXISTS job_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')) DEFAULT 'PENDING',
  payload_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_ts INTEGER NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status_next_attempt ON job_queue(status, next_attempt_ts, id);

CREATE TABLE IF NOT EXISTS stat_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}',
  created_ts INTEGER NOT NULL,
  UNIQUE(key, created_ts)
);

CREATE INDEX IF NOT EXISTS idx_stat_snapshot_key_created ON stat_snapshot(key, created_ts);

