/**
 * Comprehensive Migration Runner for Project Manager
 *
 * This script runs ALL database migrations from the migrations folder
 * Safe to run multiple times (idempotent)
 * Automatically discovers all .sql files in database/migrations/
 *
 * Usage:
 *   node run-all-migrations.js
 *
 * Environment Variables:
 *   DATABASE_URL - Full PostgreSQL connection string (preferred)
 *   OR
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Individual connection params
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  port: process.env.DATABASE_URL ? undefined : process.env.DB_PORT,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function printHeader() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       PROJECT MANAGER - MIGRATION RUNNER                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printSummary(applied, skipped, errors, total) {
  console.log('\n' + '═'.repeat(60));
  console.log('Migration Summary:');
  console.log(`  ✓ Applied: ${applied}`);
  console.log(`  ⊙ Skipped (already applied): ${skipped}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log(`  Total: ${total}`);
  console.log('═'.repeat(60));

  if (errors === 0) {
    console.log('\n✅ All migrations completed successfully!\n');
    console.log('DATABASE SCHEMA READY!');
  } else {
    console.log('\n⚠️  Some migrations had errors. Check logs above.\n');
  }
}

// ============================================
// MIGRATION RUNNER
// ============================================

async function runMigrations() {
  printHeader();

  const environment = process.env.NODE_ENV || 'development';
  console.log(`Environment: ${environment}`);
  console.log(`Database: ${process.env.DB_NAME || 'from DATABASE_URL'}\n`);

  // Get migrations directory
  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  // Read all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort alphabetically (001, 002, etc.)

  if (files.length === 0) {
    console.log('⚠️  No migration files found in', migrationsDir);
    process.exit(0);
  }

  console.log(`Found ${files.length} migration file(s)\n`);

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  // Run each migration
  for (const file of files) {
    const migrationNumber = files.indexOf(file) + 1;
    const paddedNumber = String(migrationNumber).padStart(3, '0');

    console.log(`${paddedNumber}: ${file}`);
    console.log(`   File: ${file}`);

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      // Run the migration
      await pool.query(sql);
      console.log('   ✓ Applied successfully\n');
      applied++;
    } catch (error) {
      // Check if error is because something already exists (idempotent behavior)
      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate key') ||
        error.message.includes('relation') && error.message.includes('does not exist') === false
      ) {
        console.log('   ⊙ Skipped (already exists)\n');
        skipped++;
      } else {
        console.error('   ✗ Error:', error.message);
        console.error('');
        errors++;
      }
    }
  }

  // Print summary
  printSummary(applied, skipped, errors, files.length);

  // Close database connection
  await pool.end();

  // Exit with error code if there were errors
  if (errors > 0) {
    process.exit(1);
  }
}

// ============================================
// ERROR HANDLING
// ============================================

process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:');
  console.error(error);
  process.exit(1);
});

// ============================================
// RUN MIGRATIONS
// ============================================

runMigrations();
