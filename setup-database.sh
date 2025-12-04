#!/bin/bash
echo "================================================"
echo "  PostgreSQL Database Setup"
echo "================================================"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "ERROR: PostgreSQL is not installed or not in PATH"
    echo ""
    echo "Please install PostgreSQL first:"
    echo "  Mac: brew install postgresql@15"
    echo "  Linux: sudo apt install postgresql"
    echo ""
    echo "See DATABASE_SETUP.md for detailed instructions"
    echo ""
    exit 1
fi

echo "PostgreSQL is installed!"
echo ""
echo "Creating database 'project_manager'..."
echo ""

# Create database
psql -U postgres -c "CREATE DATABASE project_manager;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Database created successfully"
else
    echo "Note: Database may already exist, continuing..."
fi

echo ""
echo "Loading database schema..."
echo ""

# Run schema
psql -U postgres -d project_manager -f database/schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "  SUCCESS! Database is ready!"
    echo "================================================"
    echo ""
    echo "Database: project_manager"
    echo "User: postgres"
    echo "Host: localhost:5432"
    echo ""
    echo "You can now start the server:"
    echo "  cd server"
    echo "  npm run dev"
    echo ""
else
    echo ""
    echo "================================================"
    echo "  ERROR: Failed to create schema"
    echo "================================================"
    echo ""
    echo "Please check:"
    echo "1. PostgreSQL service is running"
    echo "2. Password is set correctly in server/.env"
    echo "3. You have the correct credentials"
    echo ""
    echo "See DATABASE_SETUP.md for troubleshooting."
    echo ""
fi
