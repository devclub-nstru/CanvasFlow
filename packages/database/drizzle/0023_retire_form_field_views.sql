-- Retires `form_field_views`, the one table that exists in the database but
-- not in the schema.
--
-- It was created in migration 0003, gained a column in 0004 and an index in
-- 0005, and its model was later deleted from schema.ts without a migration —
-- so every database that has run the chain still carries it while nothing in
-- the codebase has referenced it since. It is dead weight, not a dependency:
-- its two foreign keys point *outward* at forms and form_fields, and nothing
-- points back at it.
--
-- Hand-written rather than generated. drizzle-kit reports "no schema changes"
-- because the table is already absent from the snapshot (0021 removed it from
-- the snapshot while deliberately not emitting the drop), so it will never
-- propose this itself.
--
-- DROP IF EMPTY, deliberately.
--
-- This project has no database backups yet, which makes an unconditional DROP
-- a bet that nobody wants to lose. If the table holds rows, this leaves it
-- alone and says so: a table nobody reads costs almost nothing, and losing
-- rows nobody can restore costs a great deal. Re-run it after clearing the
-- table, or replace it with a plain DROP once you have verified the contents
-- and have a backup.
--
-- No CASCADE, on purpose. Nothing depends on this table, so a plain DROP is
-- correct; if that assumption were ever wrong, this fails loudly instead of
-- quietly destroying whatever depended on it.
DO $$
DECLARE
  row_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'form_field_views'
  ) THEN
    RAISE NOTICE 'form_field_views is already gone — nothing to do.';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.form_field_views' INTO row_count;

  IF row_count = 0 THEN
    DROP TABLE public.form_field_views;
    RAISE NOTICE 'form_field_views was empty and has been dropped.';
  ELSE
    RAISE WARNING
      'form_field_views still holds % row(s), so it has NOT been dropped. Review the data, then drop it deliberately.',
      row_count;
  END IF;
END $$;
