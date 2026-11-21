-- Which API token or OAuth app wrote a comment, as its label at write time.
-- Null for browser sessions and for every comment written before this column.
-- Additive only; older builds never read it.
ALTER TABLE comments ADD COLUMN actor_label TEXT;
