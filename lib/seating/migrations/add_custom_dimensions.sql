-- Add custom width/height, rotation columns and remove flip columns.
-- Run this in the Supabase SQL editor or via migration tool.

ALTER TABLE seating_tables ADD COLUMN custom_width REAL;
ALTER TABLE seating_tables ADD COLUMN custom_height REAL;
ALTER TABLE seating_tables ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seating_tables DROP COLUMN IF EXISTS flip_x;
ALTER TABLE seating_tables DROP COLUMN IF EXISTS flip_y;
