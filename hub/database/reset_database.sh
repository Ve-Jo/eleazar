#!/bin/bash

# Complete Database Reset Script for Prisma
# This script will wipe the database and regenerate the schema

echo "🗑️  Starting database wipe..."

# Execute the SQL wipe script
psql "postgresql://eleazar:eleazar@localhost:5432/eleazar" -f /home/yakov/eleazar-hub/database/wipe_database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database wiped successfully!"
    
    echo "🔄 Regenerating Prisma schema..."
    
    # Reset Prisma migrations and regenerate
    npx prisma migrate reset --force
    
    if [ $? -eq 0 ]; then
        echo "✅ Prisma schema regenerated successfully!"
        echo "🎉 Database reset complete!"
    else
        echo "❌ Error regenerating Prisma schema"
        echo "You may need to run 'npx prisma migrate dev' manually"
    fi
else
    echo "❌ Error wiping database"
fi

echo "📊 Current database status:"
psql "postgresql://eleazar:eleazar@localhost:5432/eleazar" -c "SELECT COUNT(*) as remaining_tables FROM pg_tables WHERE schemaname = 'public';"