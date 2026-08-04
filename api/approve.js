const { getSheetsClient, ensureHeaders } = require('./_lib/sheets');
const { cors }                           = require('./_lib/cors');
const { writeAuditLog }                  = require('./_lib/audit');
const { verifyUser, verifyAdmin }        = require('./_lib/auth');
const {
  SPREADSHEET_ID, SHEET,
  PENDING_COLUMNS, DB_COLUMNS, KEY_MAP,
} = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets   = getSheetsClient();
    const username = req.headers['x-username'];

    // ── GET: any authenticated user can read pending list ────────────────
    if (req.method === 'GET') {
      const auth = await verifyUser(sheets, username);
      if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A1:T`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return res.status(200).json({ success: true, requests: [] });

      const headers  = rows[0];
      const requests = rows.slice(1).map((row, idx) => {
        const r = { _row: idx + 2 };
        headers.forEach((h, i) => { r[h] = row[i] || ''; });
        return r;
      });

      return res.status(200).json({
        success: true,
        requests: requests.map(r => ({
          row:             r._row,
          dateRequested:   r['DATE REQUESTED']   || '',
          jobId:           r['JOB ID']            || '',
          particulars:     r['PARTICULARS']       || '',
          consignee:       r['CONSIGNEE']         || '',
          mbl:             r['MBL']               || '',
          hbl:             r['HBL']               || '',
          containerNumber: r['CONTAINER NUMBER']  || '',
          requestedBy:     r['REQUESTED BY']      || '',
          supplierName:    r["SUPPLIER'S NAME"]   || '',
          accountNo:       r['ACCOUNT NO.']       || '',
          bankName:        r['BANK NAME']         || '',
          totalAmount:     r['TOTAL AMOUNT']      || '',
          paymentStatus:   r['INVOICE DUE DATE']  || '',
          timestamp:       r['TIMESTAMP']         || '',
          submittedBy:     r['SUBMITTED BY']      || '',
          status:          r['STATUS']            || 'PENDING',
          adminRemarks:    r['ADMIN_REMARKS']     || '',
          reviewedBy:      r['REVIEWED_BY']       || '',
          reviewedAt:      r['REVIEWED_AT']       || '',
          attachedFiles:   r['ATTACHED FILES']    || '',
        })),
      });
    }

    // ── POST: any authenticated user can submit a request ────────────────
    if (req.method === 'POST') {
      const auth = await verifyUser(sheets, username);
      if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

      const data        = req.body || {};
      const submittedBy = auth.user.username; // always from verified session
      const jobId       = (data.job_id || '').trim();

      // Input length guards
      if (jobId.length > 100) {
        return res.status(400).json({ success: false, error: 'Job ID too long.' });
      }

      if (jobId) {
        const [pendingRes, dbRes] = await Promise.allSettled([
          sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET.PENDING}!B:B` }),
          sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET.DATABASE}!B:B` }),
        ]);

        const toIds = result =>
          result.status === 'fulfilled'
            ? (result.value.data.values || []).slice(1).map(r => (r[0] || '').trim().toUpperCase()).filter(Boolean)
            : [];

        const allIds = [...toIds(pendingRes), ...toIds(dbRes)];
        if (allIds.includes(jobId.toUpperCase())) {
          return res.status(409).json({
            success: false,
            error: `Job ID "${jobId}" already exists in the system. Duplicate entries are not allowed.`,
          });
        }
      }

      const row = PENDING_COLUMNS.map(col => {
        if (col === 'SUBMITTED BY')   return submittedBy;
        if (col === 'STATUS')         return 'PENDING';
        if (col === 'ADMIN_REMARKS')  return '';
        if (col === 'REVIEWED_BY')    return '';
        if (col === 'REVIEWED_AT')    return '';
        if (col === 'ATTACHED FILES') return data.attached_files || '';
        const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
        const val = (key && data[key] !== undefined) ? String(data[key]) : '';
        return (key === 'job_id') ? val.trim() : val;
      });

      await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.PENDING, PENDING_COLUMNS);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });

      await writeAuditLog(
        sheets, 'REQUEST_SUBMITTED', submittedBy,
        `Job ID: ${jobId || 'N/A'} | ${data.particulars || ''} | ₱${data.amount_2 || '0'}`
      );

      return res.status(200).json({ success: true, message: 'Request submitted for approval.' });
    }

    // ── PUT: only admin can approve / reject ─────────────────────────────
    if (req.method === 'PUT') {
      const auth = await verifyAdmin(sheets, username);
      if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

      const { row, action, remarks, reviewedBy } = req.body || {};
      if (!row || !action) {
        return res.status(400).json({ success: false, error: 'Row and action required.' });
      }
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
      }

      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A${row}:T${row}`,
      });
      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'Request not found.' });
      }

      const rowData  = current.data.values[0];
      const now      = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const reviewer = reviewedBy || auth.user.username;

      const statusIdx     = PENDING_COLUMNS.indexOf('STATUS');
      const remarksIdx    = PENDING_COLUMNS.indexOf('ADMIN_REMARKS');
      const reviewedByIdx = PENDING_COLUMNS.indexOf('REVIEWED_BY');
      const reviewedAtIdx = PENDING_COLUMNS.indexOf('REVIEWED_AT');
      const jobIdIdx      = PENDING_COLUMNS.indexOf('JOB ID');
      const partIdx       = PENDING_COLUMNS.indexOf('PARTICULARS');
      const amtIdx        = PENDING_COLUMNS.indexOf('TOTAL AMOUNT');

      rowData[statusIdx]     = action === 'approve' ? 'APPROVED' : 'REJECTED';
      rowData[remarksIdx]    = remarks || '';
      rowData[reviewedByIdx] = reviewer;
      rowData[reviewedAtIdx] = now;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A${row}:T${row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] },
      });

      if (action === 'approve') {
        const dbRow = DB_COLUMNS.map(col => {
          const srcIdx = PENDING_COLUMNS.indexOf(col);
          return srcIdx >= 0 ? rowData[srcIdx] || '' : '';
        });

        await ensureHeaders(sheets, SPREADSHEET_ID, SHEET.DATABASE, DB_COLUMNS);
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET.DATABASE}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [dbRow] },
        });

        await writeAuditLog(
          sheets, 'REQUEST_APPROVED', reviewer,
          `Job ID: ${rowData[jobIdIdx]} | ${rowData[partIdx]} | ₱${rowData[amtIdx] || '0'}`,
          `Row ${row}`
        );
      } else {
        await writeAuditLog(
          sheets, 'REQUEST_REJECTED', reviewer,
          `Job ID: ${rowData[jobIdIdx]} | Reason: ${remarks}`,
          `Row ${row}`
        );
      }

      return res.status(200).json({
        success: true,
        message: action === 'approve'
          ? 'Request approved and synced to database.'
          : 'Request rejected.',
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[approve.js]', err.message);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};
