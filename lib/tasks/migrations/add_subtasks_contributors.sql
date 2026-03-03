-- Add subtasks and contributors JSONB columns to tasks table
-- subtasks: array of { title: string, is_complete: boolean }
-- contributors: array of strings (names)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]'::jsonb;
