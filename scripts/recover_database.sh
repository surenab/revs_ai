#!/bin/bash

# Database recovery script for SQLite
# This script attempts to recover data from a corrupted SQLite database

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$APP_DIR"

DB_FILE="db.sqlite3"
BACKUP_DIR="${APP_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CORRUPTED_BACKUP="${BACKUP_DIR}/db_corrupted_${DATE}.sqlite3"
RECOVERED_DUMP="${BACKUP_DIR}/db_recovered_${DATE}.sql"
NEW_DB="${APP_DIR}/db_new.sqlite3"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}🔍 Checking database file...${NC}"

if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}❌ Error: $DB_FILE not found!${NC}"
    exit 1
fi

# Step 1: Backup the corrupted database
echo -e "${YELLOW}📦 Creating backup of corrupted database...${NC}"
cp "$DB_FILE" "$CORRUPTED_BACKUP"
echo -e "${GREEN}✅ Backup created: $CORRUPTED_BACKUP${NC}"

# Step 2: Try to recover data using SQLite's .dump command
echo -e "${YELLOW}🔧 Attempting to recover data from corrupted database...${NC}"

if sqlite3 "$DB_FILE" ".dump" > "$RECOVERED_DUMP" 2>&1; then
    echo -e "${GREEN}✅ Successfully dumped database content!${NC}"

    # Step 3: Create a new database from the dump
    echo -e "${YELLOW}🔄 Creating new database from recovered data...${NC}"

    if sqlite3 "$NEW_DB" < "$RECOVERED_DUMP" 2>&1; then
        echo -e "${GREEN}✅ Successfully created new database!${NC}"

        # Step 4: Verify the new database
        echo -e "${YELLOW}🔍 Verifying new database...${NC}"
        if sqlite3 "$NEW_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
            echo -e "${GREEN}✅ New database integrity check passed!${NC}"

            # Step 5: Replace the old database
            echo -e "${YELLOW}🔄 Replacing corrupted database with recovered one...${NC}"
            mv "$DB_FILE" "${DB_FILE}.old_${DATE}"
            mv "$NEW_DB" "$DB_FILE"

            echo -e "${GREEN}✅ Database recovery completed successfully!${NC}"
            echo -e "${GREEN}   Old database saved as: ${DB_FILE}.old_${DATE}${NC}"
            echo -e "${GREEN}   Recovered dump saved as: $RECOVERED_DUMP${NC}"
            echo ""
            echo -e "${YELLOW}⚠️  Next steps:${NC}"
            echo -e "   1. Run: python manage.py migrate"
            echo -e "   2. Test your application"
            echo -e "   3. If everything works, you can delete: ${DB_FILE}.old_${DATE}"
        else
            echo -e "${RED}❌ New database failed integrity check!${NC}"
            echo -e "${YELLOW}   The dump file is saved at: $RECOVERED_DUMP${NC}"
            echo -e "${YELLOW}   You may need to manually inspect and fix the dump file.${NC}"
            rm -f "$NEW_DB"
            exit 1
        fi
    else
        echo -e "${RED}❌ Failed to create new database from dump!${NC}"
        echo -e "${YELLOW}   The dump file is saved at: $RECOVERED_DUMP${NC}"
        echo -e "${YELLOW}   You may need to manually inspect and fix the dump file.${NC}"
        rm -f "$NEW_DB"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to dump database content!${NC}"
    echo -e "${YELLOW}   The database may be too corrupted to recover automatically.${NC}"
    echo ""
    echo -e "${YELLOW}📋 Alternative recovery options:${NC}"
    echo -e "   1. Try using SQLite's recovery tool:"
    echo -e "      sqlite3 $DB_FILE '.recover' | sqlite3 db_new.sqlite3"
    echo -e "   2. If you have a backup, restore from backup"
    echo -e "   3. If no backup exists, you may need to recreate the database:"
    echo -e "      rm $DB_FILE"
    echo -e "      python manage.py migrate"
    echo -e "      python manage.py createsuperuser"
    echo ""
    echo -e "${YELLOW}   Corrupted database backup saved at: $CORRUPTED_BACKUP${NC}"
    exit 1
fi
