const { google } = require('googleapis');

// ── Configuration ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';
const PENDING_SHEET = 'PENDING';
const DATABASE_SHEET = 'DATABASE';
const AUDIT_SHEET = 'AUDIT_LOG';

const PENDING_COLUMNS = [
  'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
  'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
  'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP',
  'SUBMITTED BY', 'STATUS', 'ADMIN_REMARKS', 'REVIEWED_BY', 'REVIEWED_AT',
];

const DB_COLUMNS = [
  'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
  'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
  'BANK NAME', 'TOTAL AMOUNT', 'PAYMENT STATUS', 'TIMESTAMP',
];

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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawCreds = process.env.GOOGLE_CREDENTIALS;
    if (!rawCreds) return res.status(500).json({ success: false, error: 'GOOGLE_CREDENTIALS not set.' });

    const credentials = JSON.parse(rawCreds);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // ── Audit Log Helper ──────────────────────────────────────────────────────
    async function writeAuditLog(action, user, details, target) {
      try {
        const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        // Ensure headers
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1:A1`,
        });
        if (!existing.data.values || existing.data.values.length === 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1`, valueInputOption: 'RAW',
            requestBody: { values: [['TIMESTAMP', 'ACTION', 'USER', 'DETAILS', 'TARGET']] },
          });
        }
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: `${AUDIT_SHEET}!A1`, valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[now, action, user, details || '', target || '']] },
        });
      } catch (e) { console.error('[audit] Write failed:', e.message); }
    }

    // ── GET: List pending requests ───────────────────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_SHEET}!A1:S`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        return res.status(200).json({ success: true, requests: [] });
      }

      const headers = rows[0];
      const requests = rows.slice(1).map((row, idx) => {
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
    }

    // ── POST: Submit new request to PENDING ──────────────────────────────────
    if (req.method === 'POST') {
      const data = req.body || {};
      const submittedBy = data.submitted_by || 'unknown';

      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

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
      const jobId = (data.job_id || '').trim();
      if (jobId) {
        let pendingIds = [];
        let dbIds = [];

        try {
          const pendingRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: `${PENDING_SHEET}!B:B`,
          });
          pendingIds = (pendingRes.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase());
        } catch (e) {
          console.error('[approve.js] Failed to read PENDING for duplicate check:', e.message);
        }

        try {
          const dbRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: `${DATABASE_SHEET}!B:B`,
          });
          dbIds = (dbRes.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase());
        } catch (e) {
          console.error('[approve.js] Failed to read DATABASE for duplicate check:', e.message);
        }

        console.log(`[approve.js] Duplicate check for "${jobId.toUpperCase()}": PENDING=${pendingIds.length} entries, DATABASE=${dbIds.length} entries`);

        if (pendingIds.includes(jobId.toUpperCase()) || dbIds.includes(jobId.toUpperCase())) {
          return res.status(409).json({
            success: false,
            error: `Job ID "${jobId}" already exists in the system. Duplicate entries are not allowed.`,
          });
        }
      }

      // Ensure headers exist
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_SHEET}!A1:A1`,
      });

      if (!existing.data.values || existing.data.values.length === 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${PENDING_SHEET}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [PENDING_COLUMNS] },
        });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_SHEET}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });

      // Log audit
      const auditJobId = data.job_id || 'N/A';
      await writeAuditLog('REQUEST_SUBMITTED', submittedBy, `Job ID: ${auditJobId} | ${data.particulars || ''} | ₱${data.amount_2 || '0'}`, '');

      return res.status(200).json({ success: true, message: 'Request submitted for approval.', _v: '2.0' });
    }

    // ── PUT: Approve or reject a request ─────────────────────────────────────
    if (req.method === 'PUT') {
      const { row, action, remarks, reviewedBy } = req.body || {};

      if (!row || !action) {
        return res.status(400).json({ success: false, error: 'Row and action required.' });
      }

      // Read the pending row
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_SHEET}!A${row}:S${row}`,
      });

      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'Request not found.' });
      }

      const rowData = current.data.values[0];
      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

      // Update status columns (indices 15-18)
      rowData[15] = action === 'approve' ? 'APPROVED' : 'REJECTED'; // STATUS
      rowData[16] = remarks || ''; // ADMIN_REMARKS
      rowData[17] = reviewedBy || 'admin'; // REVIEWED_BY
      rowData[18] = now; // REVIEWED_AT

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_SHEET}!A${row}:S${row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] },
      });

      // If approved, also copy to DATABASE sheet
      if (action === 'approve') {
        const dbRow = DB_COLUMNS.map(col => {
          const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
          if (key) {
            const idx = PENDING_COLUMNS.indexOf(KEY_MAP[key]);
            return idx >= 0 ? rowData[idx] || '' : '';
          }
          return '';
        });

        // Ensure DB headers exist
        const dbExisting = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${DATABASE_SHEET}!A1:A1`,
        });

        if (!dbExisting.data.values || dbExisting.data.values.length === 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${DATABASE_SHEET}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [DB_COLUMNS] },
          });
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${DATABASE_SHEET}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [dbRow] },
        });

        // Log audit - approved
        await writeAuditLog('REQUEST_APPROVED', reviewedBy || 'admin', `Job ID: ${rowData[1]} | ${rowData[2]} | ₱${rowData[11] || '0'}`, `Row ${row}`);
      } else {
        // Log audit - rejected
        await writeAuditLog('REQUEST_REJECTED', reviewedBy || 'admin', `Job ID: ${rowData[1]} | Reason: ${remarks}`, `Row ${row}`);
      }

      return res.status(200).json({
        success: true,
        message: action === 'approve' ? 'Request approved and synced to database.' : 'Request rejected.',
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[approve.js] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
