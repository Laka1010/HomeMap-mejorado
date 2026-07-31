-- Migration: completed_at on tasks
-- Date: 2026-07-30
--
-- Supports auto-deleting tasks a configurable number of days after they are
-- marked done (client reads this to decide what's expired). Set when a task
-- moves to status = 'done', cleared on reopen.

alter table public.tasks add column if not exists completed_at timestamptz;

-- EOF
