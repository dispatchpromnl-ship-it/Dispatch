/**
 * Local development server — mirrors the Vercel API routes using in-memory data.
 * For production, deploy to Vercel where /api/* are serverless functions.
 */
const express = require('express');
const path    = require('path');

const { hashPassword }                           = require('./api/_lib/hash');
const { PENDING_COLUMNS, DB_COLUMNS, KEY_MAP }   = require('./api/_lib/constants');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory data stores ─────────────────────────────────────────────────────
const now = () => new Date().toISOString();

const USERS_SHEET = [
  ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'],
  ['ADMIN1', hashPassword('admin123'), 'admin', 'ADMIN ONE',   'YES', now()],
  ['ADMIN2', hashPassword('admin123'), 'admin', 'ADMIN TWO',   'YES', now()],
  ['USER1',  hashPassword('user123'),  'user',  'USER ONE',    'YES', now()],
  ['USER2',  hashPassword('user123'),  'user',  'USER TWO',    'YES', now()],
  ['USER3',  hashPassword('user123'),  'user',  'USER THREE',  'YES', now()],
  ['USER4',  hashPassword('user123'),  'user',  'USER FOUR',   'YES', now()],
  ['USER5',  hashPassword('user123'),  'user',  'USER FIVE',   'YES', now()],
  ['USER6',  hashPassword('user123'),  'user',  'USER SIX',    'YES', now()],
  ['USER7',  hashPassword('user123'),  'user',  'USER SEVEN',  'YES', now()],
  ['USER8',  hashPassword('user123'),  'user',  'USER EIGHT',  'YES', now()],
];

let PENDING_SHEET  = [PENDING_COLUMNS.slice()];
let DATABASE_SHEET = [DB_COLUMNS.slice()];
let AUDIT_LOG      = [['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET']];

// ── Helpers ───────────────────────────────────────────────────────────────────
function rowsToObjects(sheet) {
  const headers = sheet[0];
  return sheet.slice(1).map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

function addAuditLog(action, user, details = '', target = '') {
  const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  AUDIT_LOG.push([ts, action, user, details, target]);
  console.log(`[AUDIT] ${action} | ${user} | ${details} ${target ? '→ ' + target : ''}`);
}

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }

  const users = rowsToObjects(USERS_SHEET);
  const user  = users.find(u => u['USERNAME'].toLowerCase() === username.toLowerCase());

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
  if (user['ACTIVE'].toUpperCase() !== 'YES') {
    return res.status(401).json({ success: false, error: 'Account is deactivated.' });
  }
  if (hashPassword(password) !== user['PASSWORD']) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  return res.status(200).json({
    success:     true,
    username:    user['USERNAME'],
    displayName: user['DISPLAY_NAME'] || user['USERNAME'],
    role:        (user['ROLE'] || 'user').toLowerCase(),
  });
});

// ── GET /api/users ────────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  const users = rowsToObjects(USERS_SHEET).map(u => ({
    row:         u._row,
    username:    u['USERNAME']     || '',
    displayName: u['DISPLAY_NAME'] || '',
    role:        u['ROLE']         || 'user',
    active:      u['ACTIVE']       || 'YES',
    created:     u['CREATED']      || '',
  }));
  return res.status(200).json({ success: true, users });
});

// ── POST /api/users ───────────────────────────────────────────────────────────
app.post('/api/users', (req, res) => {
  const { username, password, displayName, role } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
  }

  const existing = USERS_SHEET.slice(1).map(r => (r[0] || '').toLowerCase());
  if (existing.includes(username.toLowerCase())) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  USERS_SHEET.push([
    username.toUpperCase(),
    hashPassword(password),
    (role || 'user').toLowerCase(),
    displayName || username.toUpperCase(),
    'YES',
    now(),
  ]);

  addAuditLog('USER_CREATED', 'admin', `Created user ${username.toUpperCase()} (${role || 'user'})`, username.toUpperCase());
  return res.status(200).json({ success: true, message: 'User added successfully.' });
});

// ── PUT /api/users ────────────────────────────────────────────────────────────
app.put('/api/users', (req, res) => {
  const { row, active, role, password, displayName } = req.body || {};
  if (!row) return res.status(400).json({ success: false, error: 'Row number required.' });

  const idx = row - 1; // sheet row → array index (header is index 0)
  if (idx < 1 || idx >= USERS_SHEET.length) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const prev = USERS_SHEET[idx];
  USERS_SHEET[idx] = [
    prev[0],
    password ? hashPassword(password) : prev[1],
    role        || prev[2],
    displayName || prev[3],
    active !== undefined ? active.toUpperCase() : prev[4],
    prev[5],
  ];

  const changes = [
    password    && 'password reset',
    displayName && `name → "${displayName}"`,
    role        && `role → ${role}`,
    active !== undefined && `status → ${active.toUpperCase()}`,
  ].filter(Boolean);

  addAuditLog('USER_UPDATED', 'admin', changes.join(', ') || 'updated', prev[0]);
  return res.status(200).json({ success: true, message: 'User updated.' });
});

// ── GET /api/approve ──────────────────────────────────────────────────────────
app.get('/api/approve', (req, res) => {
  const requests = rowsToObjects(PENDING_SHEET).map(r => ({
    row:             r._row,
    dateRequested:   r['DATE REQUESTED']  || '',
    jobId:           r['JOB ID']          || '',
    particulars:     r['PARTICULARS']     || '',
    consignee:       r['CONSIGNEE']       || '',
    mbl:             r['MBL']             || '',
    hbl:             r['HBL']             || '',
    containerNumber: r['CONTAINER NUMBER']|| '',
    requestedBy:     r['REQUESTED BY']    || '',
    supplierName:    r["SUPPLIER'S NAME"] || '',
    accountNo:       r['ACCOUNT NO.']     || '',
    bankName:        r['BANK NAME']       || '',
    totalAmount:     r['TOTAL AMOUNT']    || '',
    paymentStatus:   r['PAYMENT STATUS']  || '',
    timestamp:       r['TIMESTAMP']       || '',
    submittedBy:     r['SUBMITTED BY']    || '',
    status:          r['STATUS']          || 'PENDING',
    adminRemarks:    r['ADMIN_REMARKS']   || '',
    reviewedBy:      r['REVIEWED_BY']     || '',
    reviewedAt:      r['REVIEWED_AT']     || '',
  }));
  return res.status(200).json({ success: true, requests });
});

// ── POST /api/approve ─────────────────────────────────────────────────────────
app.post('/api/approve', (req, res) => {
  const data        = req.body || {};
  const submittedBy = data.submitted_by || 'unknown';
  const jobId       = (data.job_id || '').trim().toUpperCase();

  if (jobId) {
    const pendingIds = PENDING_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase());
    const dbIds      = DATABASE_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase());
    if (pendingIds.includes(jobId) || dbIds.includes(jobId)) {
      return res.status(409).json({
        success: false,
        error: `Job ID "${data.job_id}" already exists. Duplicate entries are not allowed.`,
      });
    }
  }

  const row = PENDING_COLUMNS.map(col => {
    if (col === 'SUBMITTED BY')  return submittedBy;
    if (col === 'STATUS')        return 'PENDING';
    if (col === 'ADMIN_REMARKS') return '';
    if (col === 'REVIEWED_BY')   return '';
    if (col === 'REVIEWED_AT')   return '';
    const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
    return (key && data[key] !== undefined) ? String(data[key]) : '';
  });

  PENDING_SHEET.push(row);
  addAuditLog('REQUEST_SUBMITTED', submittedBy,
    `Job ID: ${data.job_id || 'N/A'} | ${data.particulars || ''} | ₱${data.amount_2 || '0'}`,
    `Row ${PENDING_SHEET.length - 1}`
  );

  console.log(`[Local] Request saved to PENDING. Total: ${PENDING_SHEET.length - 1}`);
  return res.status(200).json({ success: true, message: 'Request submitted for approval.' });
});

// ── PUT /api/approve ──────────────────────────────────────────────────────────
app.put('/api/approve', (req, res) => {
  const { row, action, remarks, reviewedBy } = req.body || {};
  if (!row || !action) {
    return res.status(400).json({ success: false, error: 'Row and action required.' });
  }

  const idx = row - 1;
  if (idx < 1 || idx >= PENDING_SHEET.length) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const rowData  = PENDING_SHEET[idx];
  const reviewer = reviewedBy || 'admin';
  const ts       = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  rowData[15] = action === 'approve' ? 'APPROVED' : 'REJECTED';
  rowData[16] = remarks  || '';
  rowData[17] = reviewer;
  rowData[18] = ts;

  if (action === 'approve') {
    const dbRow = DB_COLUMNS.map(col => {
      const srcIdx = PENDING_COLUMNS.indexOf(col);
      return srcIdx >= 0 ? rowData[srcIdx] || '' : '';
    });
    DATABASE_SHEET.push(dbRow);
    addAuditLog('REQUEST_APPROVED', reviewer,
      `Job ID: ${rowData[1]} | ${rowData[2]} | ₱${rowData[11] || '0'}`, `Row ${row}`);
    console.log(`[Local] Request approved. DB rows: ${DATABASE_SHEET.length - 1}`);
  } else {
    addAuditLog('REQUEST_REJECTED', reviewer, `Job ID: ${rowData[1]} | Reason: ${remarks}`, `Row ${row}`);
    console.log('[Local] Request rejected.');
  }

  return res.status(200).json({
    success: true,
    message: action === 'approve'
      ? 'Request approved and synced to database.'
      : 'Request rejected.',
  });
});

// ── GET /api/check-job-id ─────────────────────────────────────────────────────
app.get('/api/check-job-id', (req, res) => {
  const pendingIds = PENDING_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const dbIds      = DATABASE_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const allIds     = [...new Set([...pendingIds, ...dbIds])];
  return res.json({ success: true, pendingIds, dbIds, allIds });
});

// ── GET /api/audit ────────────────────────────────────────────────────────────
app.get('/api/audit', (req, res) => {
  const headers = AUDIT_LOG[0];
  const logs = AUDIT_LOG.slice(1).reverse().map(row => {
    const log = {};
    headers.forEach((h, i) => { log[h] = row[i] || ''; });
    return {
      timestamp: log['TIMESTAMP'] || '',
      action:    log['ACTION']    || '',
      user:      log['USER']      || '',
      details:   log['DETAILS']   || '',
      target:    log['TARGET']    || '',
    };
  });
  return res.status(200).json({ success: true, logs });
});

// ── POST /api/audit ───────────────────────────────────────────────────────────
app.post('/api/audit', (req, res) => {
  const { action, user, details, target } = req.body || {};
  if (!action || !user) {
    return res.status(400).json({ success: false, error: 'Action and user required.' });
  }
  addAuditLog(action, user, details, target);
  return res.status(200).json({ success: true, message: 'Audit log recorded.' });
});

// ── Deprecated /api/submit ────────────────────────────────────────────────────
app.all('/api/submit', (req, res) => {
  res.status(410).json({ success: false, error: 'Deprecated. Please refresh your browser.' });
});

// ── Catch-all: serve index.html (SPA fallback) ────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          ALWEN DISPATCHER PRO — Local Development           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 App:    http://localhost:${PORT}                         ║`);
  console.log(`║  🔐 Login:  http://localhost:${PORT}/login.html              ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Default Accounts:                                          ║');
  console.log('║    Admin: ADMIN1 / admin123   Admin: ADMIN2 / admin123      ║');
  console.log('║    User:  USER1  / user123    ... up to USER8               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ⚠️  LOCAL MODE: Data is in-memory only.                    ║');
  console.log('║     Deploy to Vercel for persistent Google Sheets sync.     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
});
