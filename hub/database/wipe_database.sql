-- Complete Database Wipe Script for Prisma PostgreSQL Database
-- This script will completely remove all tables and data from your database

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Drop all tables in the correct order to avoid foreign key constraints
DROP TABLE IF EXISTS "analytics" CASCADE;
DROP TABLE IF EXISTS "music_players" CASCADE;
DROP TABLE IF EXISTS "seasons" CASCADE;
DROP TABLE IF EXISTS "marriages" CASCADE;
DROP TABLE IF EXISTS "level_roles" CASCADE;
DROP TABLE IF EXISTS "guilds" CASCADE;
DROP TABLE IF EXISTS "economy" CASCADE;
DROP TABLE IF EXISTS "levels" CASCADE;
DROP TABLE IF EXISTS "statistics" CASCADE;
DROP TABLE IF EXISTS "cooldowns" CASCADE;
DROP TABLE IF EXISTS "upgrades" CASCADE;
DROP TABLE IF EXISTS "voice_sessions" CASCADE;
DROP TABLE IF EXISTS "crates" CASCADE;
DROP TABLE IF EXISTS "legacy_game_data" CASCADE;
DROP TABLE IF EXISTS "crypto_positions" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop Prisma migrations table (this will reset migration history)
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Optional: Drop all sequences (auto-increment counters)
DO $$ 
DECLARE
    seq_name TEXT;
BEGIN
    FOR seq_name IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(seq_name) || ' CASCADE;';
    END LOOP;
END $$;

-- Optional: Drop all custom types
DO $$ 
DECLARE
    type_name TEXT;
BEGIN
    FOR type_name IN 
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e'
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(type_name) || ' CASCADE;';
    END LOOP;
END $$;

-- Verify all tables are dropped
SELECT 'Database wiped successfully!' as status;
SELECT COUNT(*) as remaining_tables FROM pg_tables WHERE schemaname = 'public';