-- Remove retired economy ledger storage
DROP INDEX IF EXISTS "economy_ledger_events_guild_id_user_id_created_at_idx";
DROP INDEX IF EXISTS "economy_ledger_events_source_created_at_idx";
DROP INDEX IF EXISTS "economy_ledger_events_created_at_idx";
DROP TABLE IF EXISTS "economy_ledger_events";
