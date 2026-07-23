const { getSheetsClient, ensureHeaders } = require('./_lib/sheets');
const { cors }                           = require('./_lib/cors');
const { writeAuditLog }                  = require('./_lib/audit');
const {
  SPREADSHEET_ID, SHEET,
  PENDING_COLUMNS, DB_COLUMNS, KEY_MAP,
} = require('./_lib/constants');

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheetsClient();

    // ── GET: List all requests from PENDING ──────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A1:S`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return res.status(200).json({ success: true, requests: [] });

      const headers = rows[0];
      const requests = rows.slice(1).map((row, idx) => {
        const r = { _row: idx + 2 };
        headers.forEach((h, i) => { r[h] = row[i] || ''; });
        return r;
      });

      return res.status(200).json({
        success: true,
        requests: requests.map(r => ({
          row:            r._row,
          dateRequested:  r['DATE REQUESTED']  || '',
          jobId:          r['JOB ID']           || '',
          particulars:    r['PARTICULARS']      || '',
          consignee:      r['CONSIGNEE']        || '',
          mbl:            r['MBL']              || '',
          hbl:            r['HBL']              || '',
          containerNumber: r['CONTAINER NUMBER'] || '',
          requestedBy:    r['REQUESTED BY']     || '',
          supplierName:   r["SUPPLIER'S NAME"]  || '',
          accountNo:      r['ACCOUNT NO.']      || '',
          bankName:       r['BANK NAME']        || '',
          totalAmount:    r['TOTAL AMOUNT']     || '',
          paymentStatus:  r['PAYMENT STATUS']   || '',
          timestamp:      r['TIMESTAMP']        || '',
          submittedBy:    r['SUBMITTED BY']     || '',
          status:         r['STATUS']           || 'PENDING',
          adminRemarks:   r['ADMIN_REMARKS']    || '',
          reviewedBy:     r['REVIEWED_BY']      || '',
          reviewedAt:     r['REVIEWED_AT']      || '',
        })),
      });
    }

    // ── POST: Submit new request to PENDING ──────────────────────────────
    if (req.method === 'POST') {
      const data        = req.body || {};
      const submittedBy = data.submitted_by || 'unknown';
      const jobId       = (data.job_id || '').trim();

      // Duplicate Job ID check across PENDING and DATABASE
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
        if (col === 'SUBMITTED BY')  return submittedBy;
        if (col === 'STATUS')        return 'PENDING';
        if (col === 'ADMIN_REMARKS') return '';
        if (col === 'REVIEWED_BY')   return '';
        if (col === 'REVIEWED_AT')   return '';
        const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
        return (key && data[key] !== undefined) ? String(data[key]) : '';
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

    // ── PUT: Approve or reject a pending request ──────────────────────────
    if (req.method === 'PUT') {
      const { row, action, remarks, reviewedBy } = req.body || {};
      if (!row || !action) {
        return res.status(400).json({ success: false, error: 'Row and action required.' });
      }

      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A${row}:S${row}`,
      });
      if (!current.data.values || current.data.values.length === 0) {
        return res.status(404).json({ success: false, error: 'Request not found.' });
      }

      const rowData = current.data.values[0];
      const now     = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const reviewer = reviewedBy || 'admin';

      rowData[15] = action === 'approve' ? 'APPROVED' : 'REJECTED';
      rowData[16] = remarks  || '';
      rowData[17] = reviewer;
      rowData[18] = now;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET.PENDING}!A${row}:S${row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] },
      });

      if (action === 'approve') {
        // Copy approved row to DATABASE using DB_COLUMNS
        const dbRow = DB_COLUMNS.map(col => {
          const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === col);
          if (key) {
            const idx = PENDING_COLUMNS.indexOf(KEY_MAP[key]);
            return idx >= 0 ? rowData[idx] || '' : '';
          }
          return '';
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
          `Job ID: ${rowData[1]} | ${rowData[2]} | ₱${rowData[11] || '0'}`,
          `Row ${row}`
        );
      } else {
        await writeAuditLog(
          sheets, 'REQUEST_REJECTED', reviewer,
          `Job ID: ${rowData[1]} | Reason: ${remarks}`,
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
