const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Mock Data (in-memory for local dev) ─────────────────────────────────────
// Simulates Google Sheets data for local development
const USERS_SHEET = [
  ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'],
  ['ADMIN1', hashPassword('admin123'), 'admin', 'ADMIN ONE', 'YES', new Date().toISOString()],
  ['ADMIN2', hashPassword('admin123'), 'admin', 'ADMIN TWO', 'YES', new Date().toISOString()],
  ['USER1', hashPassword('user123'), 'user', 'USER ONE', 'YES', new Date().toISOString()],
  ['USER2', hashPassword('user123'), 'user', 'USER TWO', 'YES', new Date().toISOString()],
  ['USER3', hashPassword('user123'), 'user', 'USER THREE', 'YES', new Date().toISOString()],
  ['USER4', hashPassword('user123'), 'user', 'USER FOUR', 'YES', new Date().toISOString()],
  ['USER5', hashPassword('user123'), 'user', 'USER FIVE', 'YES', new Date().toISOString()],
  ['USER6', hashPassword('user123'), 'user', 'USER SIX', 'YES', new Date().toISOString()],
  ['USER7', hashPassword('user123'), 'user', 'USER SEVEN', 'YES', new Date().toISOString()],
  ['USER8', hashPassword('user123'), 'user', 'USER EIGHT', 'YES', new Date().toISOString()],
];

let PENDING_SHEET = [
  ['DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
   'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
   'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP',
   'SUBMITTED BY', 'STATUS', 'ADMIN_REMARKS', 'REVIEWED_BY', 'REVIEWED_AT'],
];

let DATABASE_SHEET = [
  ['DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
   'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
   'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP'],
];

let pendingCounter = 1;

// ── Audit Log (in-memory) ─────────────────────────────────────────────────────
let AUDIT_LOG = [
  ['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET'],
];

function addAuditLog(action, user, details, target) {
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  AUDIT_LOG.push([now, action, user, details || '', target || '']);
  console.log(`[AUDIT] ${action} by ${user}: ${details} ${target ? '→ ' + target : ''}`);
}

// ── API Routes ───────────────────────────────────────────────────────────────

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }

  const headers = USERS_SHEET[0];
  const users = USERS_SHEET.slice(1).map(row => {
    const user = {};
    headers.forEach((h, i) => { user[h] = row[i] || ''; });
    return user;
  });

  const user = users.find(u =>
    u['USERNAME'] && u['USERNAME'].toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  if (user['ACTIVE'] && user['ACTIVE'].toUpperCase() !== 'YES') {
    return res.status(401).json({ success: false, error: 'Account is deactivated.' });
  }

  const inputHash = hashPassword(password);
  if (inputHash !== user['PASSWORD']) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  return res.status(200).json({
    success: true,
    username: user['USERNAME'],
    displayName: user['DISPLAY_NAME'] || user['USERNAME'],
    role: (user['ROLE'] || 'user').toLowerCase(),
  });
});

// GET /api/users
app.get('/api/users', (req, res) => {
  const headers = USERS_SHEET[0];
  const users = USERS_SHEET.slice(1).map((row, idx) => {
    const user = { _row: idx + 2 };
    headers.forEach((h, i) => { user[h] = row[i] || ''; });
    return user;
  });

  const safeUsers = users.map(u => ({
    row: u._row,
    username: u['USERNAME'] || '',
    displayName: u['DISPLAY_NAME'] || '',
    role: u['ROLE'] || 'user',
    active: u['ACTIVE'] || 'YES',
    created: u['CREATED'] || '',
  }));

  return res.status(200).json({ success: true, users: safeUsers });
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { username, password, displayName, role } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
  }

  const existingUsernames = USERS_SHEET.slice(1).map(r => (r[0] || '').toLowerCase());
  if (existingUsernames.includes(username.toLowerCase())) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  const now = new Date().toISOString();
  const row = [
    username.toUpperCase(),
    hashPassword(password),
    (role || 'user').toLowerCase(),
    displayName || username.toUpperCase(),
    'YES',
    now,
  ];

  USERS_SHEET.push(row);

  addAuditLog('USER_CREATED', 'admin', `Created user ${username.toUpperCase()} (${role || 'user'})`, username.toUpperCase());

  return res.status(200).json({ success: true, message: 'User added successfully.' });
});

// PUT /api/users
app.put('/api/users', (req, res) => {
  const { row, active, role, password, displayName } = req.body || {};

  if (!row) {
    return res.status(400).json({ success: false, error: 'Row number required.' });
  }

  const dataIdx = row - 1; // Convert 1-indexed to 0-indexed (skip header)
  if (dataIdx < 1 || dataIdx >= USERS_SHEET.length) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const existing = USERS_SHEET[dataIdx];
  USERS_SHEET[dataIdx] = [
    existing[0], // USERNAME
    password ? hashPassword(password) : existing[1], // PASSWORD
    role || existing[2], // ROLE
    displayName || existing[3], // DISPLAY_NAME
    active !== undefined ? active.toUpperCase() : existing[4], // ACTIVE
    existing[5], // CREATED
  ];

  // Log the change
  const changes = [];
  if (password) changes.push('password reset');
  if (displayName) changes.push(`name → "${displayName}"`);
  if (role) changes.push(`role → ${role}`);
  if (active !== undefined) changes.push(`status → ${active.toUpperCase()}`);
  addAuditLog('USER_UPDATED', 'admin', changes.join(', ') || 'updated', existing[0]);

  return res.status(200).json({ success: true, message: 'User updated.' });
});

// GET /api/approve
app.get('/api/approve', (req, res) => {
  const headers = PENDING_SHEET[0];
  const requests = PENDING_SHEET.slice(1).map((row, idx) => {
    const req = { _row: idx + 2 };
    headers.forEach((h, i) => { req[h] = row[i] || ''; });
    return req;
  });

  const safeRequests = requests.map(r => ({
    row: r._row,
    dateRequested: r['DATE REQUESTED'] || '',
    jobId: r['JOB ID'] || '',
    particulars: r['PARTICULARS'] || '',
    consignee: r['CONSIGNEE'] || '',
    mbl: r['MBL'] || '',
    hbl: r['HBL'] || '',
    containerNumber: r['CONTAINER NUMBER'] || '',
    requestedBy: r['REQUESTED BY'] || '',
    supplierName: r["SUPPLIER'S NAME"] || '',
    accountNo: r['ACCOUNT NO.'] || '',
    bankName: r['BANK NAME'] || '',
    totalAmount: r['TOTAL AMOUNT'] || '',
    paymentStatus: r['PAYMENT STATUS'] || '',
    timestamp: r['TIMESTAMP'] || '',
    submittedBy: r['SUBMITTED BY'] || '',
    status: r['STATUS'] || 'PENDING',
    adminRemarks: r['ADMIN_REMARKS'] || '',
    reviewedBy: r['REVIEWED_BY'] || '',
    reviewedAt: r['REVIEWED_AT'] || '',
  }));

  return res.status(200).json({ success: true, requests: safeRequests });
});

// POST /api/approve (submit new request)
app.post('/api/approve', (req, res) => {
  const data = req.body || {};
  const submittedBy = data.submitted_by || 'unknown';
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  const KEY_MAP = {
    date_requested: 'DATE REQUESTED',
    job_id: 'JOB ID',
    particulars: 'PARTICULARS',
    consignee: 'CONSIGNEE',
    mbl: 'MBL',
    hbl: 'HBL',
    container_number: 'CONTAINER NUMBER',
    requested_by: 'REQUESTED BY',
    supplier_name: "SUPPLIER'S NAME",
    account_no: 'ACCOUNT NO.',
    bank_name: 'BANK NAME',
    amount_2: 'TOTAL AMOUNT',
    payment_status: 'PAYMENT STATUS',
    timestamp: 'TIMESTAMP',
  };

  const PENDING_COLUMNS = PENDING_SHEET[0];
  const row = PENDING_COLUMNS.map(col => {
    if (col === 'SUBMITTED BY') return submittedBy;
    if (col === 'STATUS') return 'PENDING';
    if (col === 'ADMIN_REMARKS') return '';
    if (col === 'REVIEWED_BY') return '';
    if (col === 'REVIEWED_AT') return '';
    const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
    return key && data[key] !== undefined ? String(data[key]) : '';
  });

  // ── Check for duplicate JOB ID in PENDING and DATABASE ──────────────
  const jobId = (data.job_id || '').trim().toUpperCase();
  if (jobId) {
    const pendingIds = PENDING_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase());
    const dbIds = DATABASE_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase());

    if (pendingIds.includes(jobId) || dbIds.includes(jobId)) {
      return res.status(409).json({
        success: false,
        error: `Job ID "${data.job_id}" already exists. Duplicate entries are not allowed.`,
      });
    }
  }

  PENDING_SHEET.push(row);
  pendingCounter++;

  const jobId = data.job_id || 'N/A';
  addAuditLog('REQUEST_SUBMITTED', submittedBy, `Job ID: ${jobId} | ${data.particulars || ''} | ₱${data.amount_2 || '0'}`, `Row ${PENDING_SHEET.length - 1}`);

  console.log(`[Local] Request #${pendingCounter} saved to PENDING. Total: ${PENDING_SHEET.length - 1}`);

  return res.status(200).json({ success: true, message: 'Request submitted for approval.' });
});

// PUT /api/approve (approve/reject)
app.put('/api/approve', (req, res) => {
  const { row, action, remarks, reviewedBy } = req.body || {};

  if (!row || !action) {
    return res.status(400).json({ success: false, error: 'Row and action required.' });
  }

  const dataIdx = row - 1;
  if (dataIdx < 1 || dataIdx >= PENDING_SHEET.length) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const rowData = PENDING_SHEET[dataIdx];
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  // Update status
  rowData[15] = action === 'approve' ? 'APPROVED' : 'REJECTED';
  rowData[16] = remarks || '';
  rowData[17] = reviewedBy || 'admin';
  rowData[18] = now;

  // If approved, copy to DATABASE
  if (action === 'approve') {
    const DB_COLUMNS = DATABASE_SHEET[0];
    const KEY_MAP = {
      'DATE REQUESTED': 'DATE REQUESTED',
      'JOB ID': 'JOB ID',
      'PARTICULARS': 'PARTICULARS',
      'CONSIGNEE': 'CONSIGNEE',
      'MBL': 'MBL',
      'HBL': 'HBL',
      'CONTAINER NUMBER': 'CONTAINER NUMBER',
      'REQUESTED BY': 'REQUESTED BY',
      "SUPPLIER'S NAME": "SUPPLIER'S NAME",
      'ACCOUNT NO.': 'ACCOUNT NO.',
      'BANK NAME': 'BANK NAME',
      'TOTAL AMOUNT': 'TOTAL AMOUNT',
      'PAYMENT STATUS': 'PAYMENT STATUS',
      'TIMESTAMP': 'TIMESTAMP',
    };

    const dbRow = DB_COLUMNS.map(col => {
      const srcIdx = PENDING_SHEET[0].indexOf(col);
      return srcIdx >= 0 ? rowData[srcIdx] || '' : '';
    });

    DATABASE_SHEET.push(dbRow);
    addAuditLog('REQUEST_APPROVED', reviewedBy || 'admin', `Job ID: ${rowData[1]} | ${rowData[2]} | ₱${rowData[11] || '0'}`, `Row ${row}`);
    console.log(`[Local] Request approved and copied to DATABASE. Total DB rows: ${DATABASE_SHEET.length - 1}`);
  } else {
    addAuditLog('REQUEST_REJECTED', reviewedBy || 'admin', `Job ID: ${rowData[1]} | Reason: ${remarks}`, `Row ${row}`);
    console.log(`[Local] Request rejected.`);
  }

  return res.status(200).json({
    success: true,
    message: action === 'approve' ? 'Request approved and synced to database.' : 'Request rejected.',
  });
});

// GET /api/check-job-id — returns all JOB IDs from PENDING and DATABASE
app.get('/api/check-job-id', (req, res) => {
  const pendingIds = PENDING_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const dbIds = DATABASE_SHEET.slice(1).map(r => (r[1] || '').trim().toUpperCase()).filter(Boolean);
  const allIds = [...new Set([...pendingIds, ...dbIds])];
  return res.json({ success: true, pendingIds, dbIds, allIds });
});

// ── Deprecated /api/submit — reject old cached frontends ─────────────────────
app.all('/api/submit', (req, res) => {
  res.status(410).json({ success: false, error: 'Deprecated. Please refresh your browser.' });
});

// ── Catch-all: serve index.html ──────────────────────────────────────────────

// GET /api/audit
app.get('/api/audit', (req, res) => {
  const headers = AUDIT_LOG[0];
  const logs = AUDIT_LOG.slice(1).reverse().map(row => {
    const log = {};
    headers.forEach((h, i) => { log[h] = row[i] || ''; });
    return {
      timestamp: log['TIMESTAMP'] || '',
      action: log['ACTION'] || '',
      user: log['USER'] || '',
      details: log['DETAILS'] || '',
      target: log['TARGET'] || '',
    };
  });
  return res.status(200).json({ success: true, logs });
});

// POST /api/audit
app.post('/api/audit', (req, res) => {
  const { action, user, details, target } = req.body || {};
  if (!action || !user) return res.status(400).json({ success: false, error: 'Action and user required.' });
  addAuditLog(action, user, details, target);
  return res.status(200).json({ success: true, message: 'Audit log recorded.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          ALWEN DISPATCHER PRO — Local Development           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 App:    http://localhost:${PORT}                         ║`);
  console.log(`║  🔐 Login:  http://localhost:${PORT}/login.html              ║`);
  console.log(`║  👑 Admin:  http://localhost:${PORT}/admin.html              ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Default Accounts:                                          ║');
  console.log('║    Admin: ADMIN1 / admin123                                 ║');
  console.log('║    Admin: ADMIN2 / admin123                                 ║');
  console.log('║    User:  USER1  / user123                                  ║');
  console.log('║    User:  USER2  / user123  ... up to USER8                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ⚠️  LOCAL MODE: Data is in-memory only.                    ║');
  console.log('║     Deploy to Vercel for persistent Google Sheets sync.     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
});
