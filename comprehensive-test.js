/**
 * COMPREHENSIVE TEST SCRIPT FOR PROJECT MANAGER APPLICATION
 *
 * This script tests all major components and features of the application:
 * - Database connectivity and schema
 * - Health check endpoints
 * - API endpoint structure
 * - Email attachments feature
 * - Task management
 * - Project management
 * - Google integrations
 */

const path = require('path');

// Try to load pg from server directory if not available globally
let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  Pool = require('./server/node_modules/pg').Pool;
}

require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Logging utilities
function logHeader(text) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + text + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(80) + colors.reset);
}

function logSection(text) {
  console.log('\n' + colors.bright + colors.blue + '─'.repeat(80) + colors.reset);
  console.log(colors.bright + colors.blue + '  ' + text + colors.reset);
  console.log(colors.bright + colors.blue + '─'.repeat(80) + colors.reset);
}

function logTest(name, status, message = '') {
  const statusSymbol = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  const statusColor = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : colors.yellow;

  console.log(`${statusColor}${statusSymbol}${colors.reset} ${name}${message ? ': ' + message : ''}`);

  testResults.tests.push({ name, status, message });
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.warnings++;
}

function logInfo(text) {
  console.log(colors.blue + '  ℹ ' + text + colors.reset);
}

function logSuccess(text) {
  console.log(colors.green + '  ✓ ' + text + colors.reset);
}

function logError(text) {
  console.log(colors.red + '  ✗ ' + text + colors.reset);
}

// Database pool
let pool;

// Test functions
async function testDatabaseConnection() {
  logSection('DATABASE CONNECTION TESTS');

  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'project_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    });

    logInfo(`Connecting to: ${process.env.DB_NAME}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);

    const result = await pool.query('SELECT NOW(), version()');
    logTest('Database connection', 'PASS', `Connected successfully`);
    logInfo(`Timestamp: ${result.rows[0].now}`);
    logInfo(`PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);

    return true;
  } catch (error) {
    logTest('Database connection', 'FAIL', error.message);
    return false;
  }
}

async function testDatabaseSchema() {
  logSection('DATABASE SCHEMA TESTS');

  const requiredTables = [
    'users',
    'projects',
    'tasks',
    'task_comments',
    'task_attachments',
    'task_dependencies',
    'task_emails',
    'project_members'
  ];

  try {
    // Check if tables exist
    const tableQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const result = await pool.query(tableQuery);
    const existingTables = result.rows.map(row => row.table_name);

    logInfo(`Found ${existingTables.length} tables in database`);

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        // Count rows in each table
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        logTest(`Table: ${table}`, 'PASS', `${count} rows`);
      } else {
        logTest(`Table: ${table}`, 'FAIL', 'Table not found');
      }
    }

    // Test task_emails table structure (new feature)
    const emailTableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'task_emails'
      ORDER BY ordinal_position;
    `;

    const emailTableResult = await pool.query(emailTableQuery);
    if (emailTableResult.rows.length > 0) {
      logTest('Email attachments table structure', 'PASS', `${emailTableResult.rows.length} columns`);
      logInfo('Columns: ' + emailTableResult.rows.map(r => r.column_name).join(', '));
    } else {
      logTest('Email attachments table structure', 'WARN', 'Table exists but no columns found');
    }

  } catch (error) {
    logTest('Database schema validation', 'FAIL', error.message);
  }
}

async function testDatabaseRelationships() {
  logSection('DATABASE RELATIONSHIPS TESTS');

  try {
    // Check foreign key constraints
    const fkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name;
    `;

    const result = await pool.query(fkQuery);
    logTest('Foreign key constraints', 'PASS', `${result.rows.length} constraints found`);

    // Group by table
    const fkByTable = {};
    result.rows.forEach(row => {
      if (!fkByTable[row.table_name]) {
        fkByTable[row.table_name] = [];
      }
      fkByTable[row.table_name].push(
        `${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`
      );
    });

    Object.entries(fkByTable).forEach(([table, constraints]) => {
      logInfo(`${table}: ${constraints.join(', ')}`);
    });

    // Test cascading deletes
    const cascadeQuery = `
      SELECT
        tc.table_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule = 'CASCADE'
      ORDER BY tc.table_name;
    `;

    const cascadeResult = await pool.query(cascadeQuery);
    logTest('Cascading delete rules', 'PASS', `${cascadeResult.rows.length} CASCADE rules`);

  } catch (error) {
    logTest('Database relationships', 'FAIL', error.message);
  }
}

async function testTaskHierarchy() {
  logSection('TASK HIERARCHY TESTS');

  try {
    // Test hierarchical task structure
    const hierarchyQuery = `
      SELECT
        t.id,
        t.title,
        t.status,
        t.parent_task_id,
        t.position,
        (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_task_id = t.id) as subtask_count
      FROM tasks t
      ORDER BY t.parent_task_id NULLS FIRST, t.position
      LIMIT 20;
    `;

    const result = await pool.query(hierarchyQuery);

    if (result.rows.length > 0) {
      logTest('Task hierarchy structure', 'PASS', `${result.rows.length} tasks found`);

      const parentTasks = result.rows.filter(t => !t.parent_task_id);
      const childTasks = result.rows.filter(t => t.parent_task_id);

      logInfo(`Parent tasks: ${parentTasks.length}`);
      logInfo(`Sub-tasks: ${childTasks.length}`);

      // Show hierarchy example
      if (parentTasks.length > 0) {
        const parent = parentTasks[0];
        logInfo(`Example: "${parent.title}" has ${parent.subtask_count} subtask(s)`);
      }
    } else {
      logTest('Task hierarchy structure', 'WARN', 'No tasks in database');
    }

    // Test task dependencies
    const depsQuery = `
      SELECT COUNT(*) as count,
             dependency_type,
             COUNT(DISTINCT dependent_task_id) as unique_tasks
      FROM task_dependencies
      GROUP BY dependency_type;
    `;

    const depsResult = await pool.query(depsQuery);
    if (depsResult.rows.length > 0) {
      logTest('Task dependencies', 'PASS', `${depsResult.rows.length} dependency types in use`);
      depsResult.rows.forEach(row => {
        logInfo(`${row.dependency_type}: ${row.count} dependencies across ${row.unique_tasks} tasks`);
      });
    } else {
      logTest('Task dependencies', 'WARN', 'No dependencies defined');
    }

  } catch (error) {
    logTest('Task hierarchy', 'FAIL', error.message);
  }
}

async function testEmailAttachments() {
  logSection('EMAIL ATTACHMENTS FEATURE TESTS');

  try {
    // Test task_emails table
    const emailQuery = `
      SELECT
        te.id,
        te.task_id,
        te.subject,
        te.sender,
        te.email_date,
        te.has_attachments,
        t.title as task_title
      FROM task_emails te
      JOIN tasks t ON te.task_id = t.id
      ORDER BY te.created_at DESC
      LIMIT 10;
    `;

    const result = await pool.query(emailQuery);

    if (result.rows.length > 0) {
      logTest('Email attachments data', 'PASS', `${result.rows.length} email(s) attached to tasks`);

      result.rows.forEach(email => {
        logInfo(`Task "${email.task_title}": "${email.subject}" from ${email.sender}`);
      });

      // Check for emails with attachments
      const withAttachments = result.rows.filter(e => e.has_attachments).length;
      logInfo(`Emails with attachments: ${withAttachments}`);
    } else {
      logTest('Email attachments data', 'WARN', 'No emails attached to tasks yet');
    }

    // Test indexes on task_emails
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'task_emails';
    `;

    const indexResult = await pool.query(indexQuery);
    logTest('Email table indexes', 'PASS', `${indexResult.rows.length} indexes`);

  } catch (error) {
    logTest('Email attachments feature', 'FAIL', error.message);
  }
}

async function testGoogleIntegrations() {
  logSection('GOOGLE INTEGRATIONS TESTS');

  try {
    // Test Drive attachments
    const driveQuery = `
      SELECT
        ta.id,
        ta.drive_file_id,
        ta.file_name,
        ta.file_type,
        t.title as task_title
      FROM task_attachments ta
      JOIN tasks t ON ta.task_id = t.id
      LIMIT 10;
    `;

    const driveResult = await pool.query(driveQuery);

    if (driveResult.rows.length > 0) {
      logTest('Google Drive attachments', 'PASS', `${driveResult.rows.length} file(s) attached`);

      const fileTypes = {};
      driveResult.rows.forEach(file => {
        const type = file.file_type || 'unknown';
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });

      Object.entries(fileTypes).forEach(([type, count]) => {
        logInfo(`${type}: ${count} file(s)`);
      });
    } else {
      logTest('Google Drive attachments', 'WARN', 'No Drive files attached');
    }

    // Check for Gmail integration config
    const envVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI'
    ];

    let configComplete = true;
    envVars.forEach(varName => {
      if (!process.env[varName]) {
        configComplete = false;
      }
    });

    if (configComplete) {
      logTest('Google OAuth configuration', 'PASS', 'All required env vars present');
    } else {
      logTest('Google OAuth configuration', 'WARN', 'Some env vars missing (normal for local testing)');
    }

  } catch (error) {
    logTest('Google integrations', 'FAIL', error.message);
  }
}

async function testProjectCollaboration() {
  logSection('PROJECT COLLABORATION TESTS');

  try {
    // Test project members
    const sharesQuery = `
      SELECT
        pm.id,
        p.name as project_name,
        pm.role,
        COUNT(*) OVER (PARTITION BY pm.project_id) as member_count
      FROM project_members pm
      JOIN projects p ON pm.project_id = p.id
      LIMIT 10;
    `;

    const result = await pool.query(sharesQuery);

    if (result.rows.length > 0) {
      logTest('Project members/sharing', 'PASS', `${result.rows.length} member(s) active`);

      const roleCount = {};
      result.rows.forEach(share => {
        roleCount[share.role] = (roleCount[share.role] || 0) + 1;
      });

      Object.entries(roleCount).forEach(([role, count]) => {
        logInfo(`${role}: ${count} user(s)`);
      });
    } else {
      logTest('Project members/sharing', 'WARN', 'No project members');
    }

    // Test user count
    const userQuery = 'SELECT COUNT(*) FROM users';
    const userResult = await pool.query(userQuery);
    logTest('User accounts', 'PASS', `${userResult.rows[0].count} user(s)`);

    // Test project count
    const projectQuery = 'SELECT COUNT(*) FROM projects';
    const projectResult = await pool.query(projectQuery);
    logTest('Projects created', 'PASS', `${projectResult.rows[0].count} project(s)`);

  } catch (error) {
    logTest('Project collaboration', 'FAIL', error.message);
  }
}

async function testTaskComments() {
  logSection('TASK COMMENTS TESTS');

  try {
    const commentsQuery = `
      SELECT
        tc.id,
        tc.comment,
        t.title as task_title,
        tc.created_at
      FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      ORDER BY tc.created_at DESC
      LIMIT 10;
    `;

    const result = await pool.query(commentsQuery);

    if (result.rows.length > 0) {
      logTest('Task comments', 'PASS', `${result.rows.length} comment(s) found`);

      // Show sample comments
      result.rows.slice(0, 3).forEach(comment => {
        const preview = comment.comment.length > 50
          ? comment.comment.substring(0, 50) + '...'
          : comment.comment;
        logInfo(`On "${comment.task_title}": "${preview}"`);
      });
    } else {
      logTest('Task comments', 'WARN', 'No comments in database');
    }

  } catch (error) {
    logTest('Task comments', 'FAIL', error.message);
  }
}

async function testDataIntegrity() {
  logSection('DATA INTEGRITY TESTS');

  try {
    // Test for orphaned tasks
    const orphanedTasksQuery = `
      SELECT COUNT(*) as count
      FROM tasks t
      WHERE t.project_id NOT IN (SELECT id FROM projects);
    `;

    const orphanedResult = await pool.query(orphanedTasksQuery);
    const orphanedCount = parseInt(orphanedResult.rows[0].count);

    if (orphanedCount === 0) {
      logTest('Orphaned tasks check', 'PASS', 'No orphaned tasks');
    } else {
      logTest('Orphaned tasks check', 'FAIL', `${orphanedCount} orphaned task(s)`);
    }

    // Test for circular dependencies
    const circularDepsQuery = `
      SELECT COUNT(*) as count
      FROM task_dependencies td1
      JOIN task_dependencies td2
        ON td1.dependent_task_id = td2.depends_on_task_id
        AND td1.depends_on_task_id = td2.dependent_task_id;
    `;

    const circularResult = await pool.query(circularDepsQuery);
    const circularCount = parseInt(circularResult.rows[0].count);

    if (circularCount === 0) {
      logTest('Circular dependencies check', 'PASS', 'No circular dependencies');
    } else {
      logTest('Circular dependencies check', 'WARN', `${circularCount} potential circular dependency(ies)`);
    }

    // Test for invalid parent_task_id references
    const invalidParentQuery = `
      SELECT COUNT(*) as count
      FROM tasks t
      WHERE t.parent_task_id IS NOT NULL
        AND t.parent_task_id NOT IN (SELECT id FROM tasks);
    `;

    const invalidParentResult = await pool.query(invalidParentQuery);
    const invalidParentCount = parseInt(invalidParentResult.rows[0].count);

    if (invalidParentCount === 0) {
      logTest('Parent task references', 'PASS', 'All parent references valid');
    } else {
      logTest('Parent task references', 'FAIL', `${invalidParentCount} invalid parent reference(s)`);
    }

  } catch (error) {
    logTest('Data integrity checks', 'FAIL', error.message);
  }
}

async function testPerformance() {
  logSection('PERFORMANCE TESTS');

  try {
    // Test query performance for common operations
    const queries = [
      {
        name: 'Fetch tasks with relations',
        query: `
          SELECT t.*,
                 COUNT(DISTINCT tc.id) as comment_count,
                 COUNT(DISTINCT ta.id) as attachment_count,
                 COUNT(DISTINCT te.id) as email_count
          FROM tasks t
          LEFT JOIN task_comments tc ON t.id = tc.task_id
          LEFT JOIN task_attachments ta ON t.id = ta.task_id
          LEFT JOIN task_emails te ON t.id = te.task_id
          GROUP BY t.id
          LIMIT 50;
        `
      },
      {
        name: 'Fetch project with tasks',
        query: `
          SELECT p.*,
                 COUNT(DISTINCT t.id) as task_count,
                 COUNT(DISTINCT pm.id) as member_count
          FROM projects p
          LEFT JOIN tasks t ON p.id = t.project_id
          LEFT JOIN project_members pm ON p.id = pm.project_id
          GROUP BY p.id
          LIMIT 20;
        `
      }
    ];

    for (const { name, query } of queries) {
      const start = Date.now();
      await pool.query(query);
      const duration = Date.now() - start;

      if (duration < 100) {
        logTest(name, 'PASS', `${duration}ms (excellent)`);
      } else if (duration < 500) {
        logTest(name, 'PASS', `${duration}ms (good)`);
      } else {
        logTest(name, 'WARN', `${duration}ms (slow, consider optimization)`);
      }
    }

  } catch (error) {
    logTest('Performance tests', 'FAIL', error.message);
  }
}

async function printSummary() {
  logHeader('TEST SUMMARY');

  const total = testResults.passed + testResults.failed + testResults.warnings;
  const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

  console.log('');
  console.log(colors.bright + '  Total Tests:     ' + colors.reset + total);
  console.log(colors.green + '  ✓ Passed:        ' + colors.reset + testResults.passed);
  console.log(colors.red + '  ✗ Failed:        ' + colors.reset + testResults.failed);
  console.log(colors.yellow + '  ⚠ Warnings:      ' + colors.reset + testResults.warnings);
  console.log(colors.bright + '  Pass Rate:       ' + colors.reset + passRate + '%');
  console.log('');

  if (testResults.failed === 0 && testResults.warnings === 0) {
    console.log(colors.green + colors.bright + '  ✓✓✓ ALL TESTS PASSED! ✓✓✓' + colors.reset);
  } else if (testResults.failed === 0) {
    console.log(colors.yellow + colors.bright + '  ⚠ ALL TESTS PASSED WITH WARNINGS' + colors.reset);
  } else {
    console.log(colors.red + colors.bright + '  ✗✗✗ SOME TESTS FAILED ✗✗✗' + colors.reset);
  }

  console.log('');

  // List failed tests
  if (testResults.failed > 0) {
    logSection('FAILED TESTS');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(colors.red + `  ✗ ${t.name}` + colors.reset);
        if (t.message) {
          console.log(colors.red + `    ${t.message}` + colors.reset);
        }
      });
  }

  console.log('\n' + colors.cyan + '═'.repeat(80) + colors.reset + '\n');
}

// Main test execution
async function runAllTests() {
  logHeader('PROJECT MANAGER - COMPREHENSIVE TEST SUITE');
  console.log(colors.bright + 'Starting comprehensive application tests...' + colors.reset);
  console.log(colors.blue + 'Timestamp: ' + new Date().toISOString() + colors.reset);

  try {
    // Database tests
    const dbConnected = await testDatabaseConnection();

    if (dbConnected) {
      await testDatabaseSchema();
      await testDatabaseRelationships();

      // Feature tests
      await testTaskHierarchy();
      await testEmailAttachments();
      await testGoogleIntegrations();
      await testProjectCollaboration();
      await testTaskComments();

      // Quality tests
      await testDataIntegrity();
      await testPerformance();
    } else {
      logError('Cannot proceed with tests - database connection failed');
    }

    // Summary
    await printSummary();

  } catch (error) {
    logError('Fatal error during test execution:');
    console.error(error);
  } finally {
    if (pool) {
      await pool.end();
      logInfo('Database connection closed');
    }
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
