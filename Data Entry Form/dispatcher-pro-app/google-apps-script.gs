const SPREADSHEET_ID = '12h-hFEPh1q5SxlyeDRbqv_Nu1JuAkinzWPfKUFXf1Ao';
const SHEET_NAME = 'DATABASE';

function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toUpperCase() === SHEET_NAME.toUpperCase()) {
      return sheets[i];
    }
  }
  const names = sheets.map(s => '"' + s.getName() + '"');
  throw new Error('Sheet "' + SHEET_NAME + '" not found. Available sheets: ' + names.join(', '));
}

function doPost(e) {
  try {
    const sheet = getTargetSheet();
    const data = JSON.parse(e.postData.contents);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp','Date Requested','Job ID','Particulars','Consignee','MBL','HBL','Container Number','Total Amount (Valuation)','Requested By','Supplier Name','Service Fee Amount']);
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(), data.date_requested || '', data.job_id || '',
      data.particulars || '', data.consignee || '', data.mbl || '', data.hbl || '',
      data.container_number || '', data.amount_1 || '', data.requested_by || '',
      data.supplier_name || '', data.amount_2 || ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'running' })).setMimeType(ContentService.MimeType.JSON);
}
