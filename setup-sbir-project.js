/**
 * One-off loader: creates the SBIR meeting-prep project with tasks,
 * assignees and dependencies. Safe to run more than once.
 *
 * Run from this folder:   node setup-sbir-project.js
 */
const fs = require('fs');
const { Pool } = require('pg');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const f of ['.env.frontend.check', '.env.vercel.frontend', '.env.local', '.env.production']) {
    try {
      const raw = fs.readFileSync(f, 'utf8');
      const m = raw.match(/DATABASE_URL\s*=\s*["']?(postgres[^\s"']+)/);
      if (m) return m[1].replace(/\\n|\\r/g, '').trim();
    } catch (e) {}
  }
  throw new Error('No DATABASE_URL found');
}

const PROJECT = 'SBIR Meeting Prep - NIMH DSIR Aug 2026';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'sjenn2915@gmail.com';

const TASKS = [
 ['Resolve the science vs regulatory tension','THE GATE. An SBIR funding an RCT that tests whether Catch-Me TREATS a condition is a treatment claim under 21 CFR 801.4 and would undo the regulatory position. Proposed resolution: the hypothesis is that clinician-integrated monitoring plus psychoeducation improves the outcomes of the clinician therapy - the device is the monitoring layer, the clinician treats.','2026-08-24','2026-08-24','urgent',1,['Steve','Deb']],
 ['Decide adult vs adolescent indication','Drives trial population, recruitment cost, and whether the evidence is first-in-population. Both app store listings currently say teens.','2026-08-24','2026-08-24','urgent',2,['Steve','Deb']],
 ['Confirm Catch-Me product description for the aims','Mood capture plus on-demand library, no protocol. Any language implying a structured course contradicts the regulatory position.','2026-08-24','2026-08-24','high',3,['Deb']],
 ['Lock the control-arm design decision','Active or attention-matched control, NOT waitlist. FDA declined Big Health own published waitlist-controlled RCT as pivotal evidence. This decides whether the Phase II trial doubles as clearance evidence.','2026-08-24','2026-08-25','urgent',4,['Deb']],
 ['Draft the 2-3 page aims page','Rationale, hypotheses, methods, outcomes, instruments, final product. Bridge framing: Phase I feasibility incl RTM workflow validation; Phase II the comparative trial.','2026-08-25','2026-08-26','urgent',5,['Deb']],
 ['Draft the budget outline','Rough Phase I figures. Rebalanced worksheet now passes both the guideline and the two-thirds rule.','2026-08-25','2026-08-25','medium',6,['Steve']],
 ['Write the preliminary-data position','Pilot data is minimal. State it plainly rather than manage it.','2026-08-25','2026-08-25','medium',7,['Deb']],
 ['RTM workflow status for the Phase I aim','Accurate statement of what is built and what is not. Also audit the workflow against the FDA interpretation line - any score, flag, alert or prioritised list makes it Class II.','2026-08-24','2026-08-25','high',8,['Bob']],
 ['Internal review of the aims page','One pass looking specifically for any sentence that reads as a treatment claim.','2026-08-26','2026-08-26','urgent',9,['Steve','Bob']],
 ['Build the question list for program staff','Clinical-trial determination first. Then NDA repository expectation, study section fit, and the two-thirds budget question.','2026-08-26','2026-08-26','high',10,['Steve']],
 ['Send the aims page ahead of the meeting','Wednesday, not Thursday. A revised version if Deb answers change the product description.','2026-08-26','2026-08-26','urgent',11,['Deb']],
 ['MEETING - NIMH DSIR','40 min Teams with Maggie Sweeney, Program Officer. Adam Haim, Branch Chief, may join.','2026-08-27','2026-08-27','urgent',12,['Steve','Deb']],
 ['Same-day debrief and decisions log','Capture it while fresh; it drives the September 5 submission.','2026-08-27','2026-08-27','high',13,['Steve']],
 ['Audit ALL public Catch-Me materials for claim language','Apple listing, Google Play, catchmecoach.com, Facebook, professional PDFs. Each is labeling under 21 CFR 801.4 and establishes intended use.','2026-08-24','2026-08-25','urgent',14,['Deb','Steve']],
 ['Correct any claim language found in the audit','Google Play meta says improve mood - change to track mood. Reconcile Apple category Lifestyle vs Google Health and Fitness. Check the Apple age-rating medical treatment flag.','2026-08-25','2026-08-26','high',15,['Deb']],
 ['Confirm which entity actually owns Catch-Me','Google Play lists Catch-Me, LLC - a fourth entity alongside Bellingham Therapeutic, Aptacare, RTM Workflow and APP2CARE INC.','2026-08-24','2026-08-24','high',16,['Steve']],
];

const DEPS = [
 [4,1],[4,2],[5,3],[5,4],[5,15],[6,2],[7,3],
 [9,5],[9,6],[9,7],[9,8],[10,1],[10,2],[11,9],
 [12,11],[12,10],[13,12],[15,14],
];

(async () => {
  const pool = new Pool({ connectionString: getUrl(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const u = await c.query('SELECT id FROM users WHERE email = $1', [OWNER_EMAIL]);
    if (!u.rows.length) throw new Error('No user with email ' + OWNER_EMAIL + '. Set OWNER_EMAIL and rerun.');
    const ownerId = u.rows[0].id;

    let p = await c.query('SELECT id FROM projects WHERE name = $1', [PROJECT]);
    if (!p.rows.length) {
      p = await c.query(
        `INSERT INTO projects (name, description, owner_id, color) VALUES ($1,$2,$3,$4) RETURNING id`,
        [PROJECT, 'Prep for the 27 August NIMH DSIR meeting and the 5 September SBIR submission.', ownerId, '#1B3A4B']);
      console.log('Created project.');
    } else {
      console.log('Project already exists - updating in place.');
    }
    const projectId = p.rows[0].id;

    const ids = [];
    for (const [title, descr, sd, ed, prio, pos, people] of TASKS) {
      let t = await c.query('SELECT id FROM tasks WHERE project_id=$1 AND title=$2', [projectId, title]);
      if (!t.rows.length) {
        t = await c.query(
          `INSERT INTO tasks (project_id,title,description,start_date,end_date,status,priority,position,created_by)
           VALUES ($1,$2,$3,$4,$5,'todo',$6,$7,$8) RETURNING id`,
          [projectId, title, descr, sd, ed, prio, pos, ownerId]);
      }
      const taskId = t.rows[0].id;
      ids.push(taskId);
      for (const name of people) {
        const email = name.toLowerCase() + '@app2care.com';
        await c.query(
          `INSERT INTO task_assignees (task_id, contact_name, contact_email, assigned_by)
           SELECT $1,$2,$3,$4
           WHERE NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id=$1 AND contact_email=$3)`,
          [taskId, name, email, ownerId]);
      }
    }
    console.log('Tasks in place: ' + ids.length);

    let added = 0;
    for (const [dep, on] of DEPS) {
      const r = await c.query(
        `INSERT INTO task_dependencies (dependent_task_id, depends_on_task_id, dependency_type, lag_days, created_by)
         SELECT $1,$2,'finish_to_start',0,$3
         WHERE NOT EXISTS (SELECT 1 FROM task_dependencies WHERE dependent_task_id=$1 AND depends_on_task_id=$2)`,
        [ids[dep-1], ids[on-1], ownerId]);
      added += r.rowCount;
    }
    console.log('Dependencies added this run: ' + added + ' (of ' + DEPS.length + ' total)');

    await c.query('COMMIT');
    console.log('\nDONE. Open the project in the app and switch to the Gantt view.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAILED, rolled back: ' + e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
