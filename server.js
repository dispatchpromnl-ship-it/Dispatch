/**
 * Local development server — mirrors the Vercel API routes using in-memory data.
 * For production, deploy to Vercel where /api/* are serverless functions.
 */
const express = require('express');
const path    = require('path');

const { hashPassword, verifyPassword }        = require('./api/_lib/hash');
const { PENDING_COLUMNS, DB_COLUMNS, KEY_MAP } = require('./api/_lib/constants');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '6mb' })); // 6MB for base64 file uploads (3MB file × ~2 for base64 + overhead)
app.use(express.static(path.join(__dirname, 'public')));

// ── Timestamp helper (consistent locale format) ──────────────────────────────
function localTimestamp() {
  return new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

// ── In-memory data stores ────────────────────────────────────────────────────
const USERS_SHEET = [
  ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'],
  ['ADMIN1', hashPassword('admin123'), 'admin', 'ADMIN ONE',   'YES', localTimestamp()],
  ['ADMIN2', hashPassword('admin123'), 'admin', 'ADMIN TWO',   'YES', localTimestamp()],
  ['USER1',  hashPassword('user123'),  'user',  'USER ONE',    'YES', localTimestamp()],
  ['USER2',  hashPassword('user123'),  'user',  'USER TWO',    'YES', localTimestamp()],
  ['USER3',  hashPassword('user123'),  'user',  'USER THREE',  'YES', localTimestamp()],
  ['USER4',  hashPassword('user123'),  'user',  'USER FOUR',   'YES', localTimestamp()],
  ['USER5',  hashPassword('user123'),  'user',  'USER FIVE',   'YES', localTimestamp()],
  ['USER6',  hashPassword('user123'),  'user',  'USER SIX',    'YES', localTimestamp()],
  ['USER7',  hashPassword('user123'),  'user',  'USER SEVEN',  'YES', localTimestamp()],
  ['USER8',  hashPassword('user123'),  'user',  'USER EIGHT',  'YES', localTimestamp()],
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
  const ts = localTimestamp();
  AUDIT_LOG.push([ts, action, user, details, target]);
  console.log(`[AUDIT] ${action} | ${user} | ${details} ${target ? '→ ' + target : ''}`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function findUser(username) {
  return rowsToObjects(USERS_SHEET).find(u => u['USERNAME'].toLowerCase() === username.toLowerCase());
}

function requireAuth(req, res, next) {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(401).json({ success: false, error: 'Authentication required. Send x-username header.' });
  }
  const user = findUser(username);
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found.' });
  }
  if (user['ACTIVE'].toUpperCase() !== 'YES') {
    return res.status(401).json({ success: false, error: 'Account is deactivated.' });
  }
  req.authUser = { username: user['USERNAME'], role: user['ROLE'], displayName: user['DISPLAY_NAME'] };
  next();
}

function requireAdmin(req, res, next) {
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

// ── OPTIONS catch-all for API routes ─────────────────────────────────────────
app.options('/api/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-username');
  res.status(200).end();
});

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }

  const user = findUser(username);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
  if (user['ACTIVE'].toUpperCase() !== 'YES') {
    return res.status(401).json({ success: false, error: 'Account is deactivated.' });
  }
  if (!verifyPassword(password, user['PASSWORD'])) {
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
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
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
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
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
    localTimestamp(),
  ]);

  addAuditLog('USER_CREATED', req.authUser.username, `Created user ${username.toUpperCase()} (${role || 'user'})`, username.toUpperCase());
  return res.status(200).json({ success: true, message: 'User added successfully.' });
});

// ── PUT /api/users ────────────────────────────────────────────────────────────
app.put('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { row, active, role, password, displayName, username } = req.body || {};
  if (!row) return res.status(400).json({ success: false, error: 'Row number required.' });

  const idx = row - 1;
  if (idx < 1 || idx >= USERS_SHEET.length) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const prev = USERS_SHEET[idx];
  let newUsername = prev[0];

  // If username is being changed, validate uniqueness
  if (username && username.toUpperCase() !== prev[0]) {
    const existingUsernames = USERS_SHEET.slice(1).map(r => (r[0] || '').toLowerCase());
    if (existingUsernames.includes(username.toUpperCase().toLowerCase())) {
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }
    newUsername = username.toUpperCase();
  }

  USERS_SHEET[idx] = [
    newUsername,
    password ? hashPassword(password) : prev[1],
    role        || prev[2],
    displayName || prev[3],
    active !== undefined ? active.toUpperCase() : prev[4],
    prev[5],
  ];

  const changes = [
    password    && 'password reset',
    displayName && `name → "${displayName}"`,
    username && username.toUpperCase() !== prev[0] && `username → "${newUsername}"`,
    role        && `role → ${role}`,
    active !== undefined && `status → ${active.toUpperCase()}`,
  ].filter(Boolean);

  addAuditLog('USER_UPDATED', req.authUser.username, changes.join(', ') || 'updated', newUsername);
  return res.status(200).json({ success: true, message: 'User updated.' });
});

// ── GET /api/approve ──────────────────────────────────────────────────────────
app.get('/api/approve', requireAuth, (req, res) => {
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
    paymentStatus:   r['INVOICE DUE DATE']  || '',
    timestamp:       r['TIMESTAMP']       || '',
    submittedBy:     r['SUBMITTED BY']    || '',
    status:          r['STATUS']          || 'PENDING',
    adminRemarks:    r['ADMIN_REMARKS']   || '',
    reviewedBy:      r['REVIEWED_BY']     || '',
    reviewedAt:      r['REVIEWED_AT']     || '',
    attachedFiles:   r['ATTACHED FILES']  || '',
  }));
  return res.status(200).json({ success: true, requests });
});

// ── POST /api/approve ─────────────────────────────────────────────────────────
app.post('/api/approve', requireAuth, (req, res) => {
  const data        = req.body || {};
  const submittedBy = req.authUser.username;
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
    if (col === 'ATTACHED FILES') return data.attached_files || '';
    const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
    const val = (key && data[key] !== undefined) ? String(data[key]) : '';
    return (key === 'job_id') ? val.trim() : val;
  });

  PENDING_SHEET.push(row);
  addAuditLog('REQUEST_SUBMITTED', submittedBy,
    `Job ID: ${jobId || 'N/A'} | ${data.particulars || ''} | ₱${data.amount_2 || '0'}`,
    `Row ${PENDING_SHEET.length - 1}`
  );

  console.log(`[Local] Request saved to PENDING. Total: ${PENDING_SHEET.length - 1}`);
  return res.status(200).json({ success: true, message: 'Request submitted for approval.' });
});

// ── PUT /api/approve ──────────────────────────────────────────────────────────
app.put('/api/approve', requireAuth, requireAdmin, (req, res) => {
  const { row, action, remarks, reviewedBy } = req.body || {};
  if (!row || !action) {
    return res.status(400).json({ success: false, error: 'Row and action required.' });
  }

  const idx = row - 1;
  if (idx < 1 || idx >= PENDING_SHEET.length) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const rowData  = PENDING_SHEET[idx];
  const reviewer = reviewedBy || req.authUser.username;
  const ts       = localTimestamp();

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
app.get('/api/check-job-id', requireAuth, (req, res) => {
  const pendingIds = PENDING_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const dbIds      = DATABASE_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const allIds     = [...new Set([...pendingIds, ...dbIds])];
  return res.json({ success: true, pendingIds, dbIds, allIds });
});

// ── GET /api/audit ────────────────────────────────────────────────────────────
app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
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
app.post('/api/audit', requireAuth, requireAdmin, (req, res) => {
  const { action, details, target } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, error: 'Action required.' });
  }
  addAuditLog(action, req.authUser.username, details, target);
  return res.status(200).json({ success: true, message: 'Audit log recorded.' });
});

// ── POST /api/upload (local dev mock) ────────────────────────────────────────
app.post('/api/upload', requireAuth, (req, res) => {
  const { file, fileName, mimeType } = req.body || {};
  if (!file || !fileName) {
    return res.status(400).json({ success: false, error: 'File data and fileName required.' });
  }
  const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (!ALLOWED.includes(mimeType)) {
    return res.status(400).json({ success: false, error: `File type "${mimeType}" not allowed. Allowed: PDF, JPG, PNG, HEIC, DOC, DOCX, XLS, XLSX.` });
  }
  const buffer = Buffer.from(file, 'base64');
  const MAX = 3 * 1024 * 1024;
  if (buffer.length > MAX) {
    return res.status(400).json({ success: false, error: `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds 3MB limit.` });
  }
  const ts = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileUrl = `https://storage.googleapis.com/agx-dispatch.firebasestorage.app/${encodeURIComponent(ts + '_' + safeName)}`;
  console.log(`[Local Upload] ${safeName} (${(buffer.length / 1024).toFixed(0)}KB) → mock Firebase URL`);
  return res.status(200).json({ success: true, fileId: `${ts}_${safeName}`, fileUrl, fileName: safeName });
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
