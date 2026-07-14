// ── Web App HTTP Handlers ──────────────────────────────────────────────────

/**
 * ⚠️  IMPORTANT: Paste your Google Spreadsheet ID here.
 * Find it in the Sheet URL:
 * https://docs.google.com/spreadsheets/d/ ➜ [SPREADSHEET_ID] ⬅ /edit
 */
var SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';

/**
 * doGet — Called when the Web App URL is accessed via GET.
 * Used by the frontend "connection check" ping.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'online' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * doPost — Called when the Vercel frontend POSTs form data.
 * Accepts JSON body and appends a row to the active sheet.
 * Uses openById() to ensure the correct spreadsheet is targeted
 * even when called via HTTP (no active spreadsheet context).
 */
function doPost(e) {
  try {
    // Parse the incoming JSON payload
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    // Open the spreadsheet by ID (required for HTTP context)
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0]; // Always writes to the first/leftmost sheet tab

    // Read current headers from row 1
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      : [];

    // Expected column headers (must match row 1 of the sheet exactly)
    var expectedHeaders = [
      'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE',
      'MBL', 'HBL', 'CONTAINER NUMBER', 'REQUESTED BY',
      "SUPPLIER'S NAME", 'ACCOUNT NO.', 'BANK NAME', 'TOTAL AMOUNT',
      'PAYMENT STATUS', 'TIMESTAMP'
    ];

    var activeHeaders = headers.length > 0 ? headers : expectedHeaders;

    // If sheet is completely empty, write headers first
    if (headers.length === 0) {
      sheet.appendRow(expectedHeaders);
      activeHeaders = expectedHeaders;
    }

    // Map incoming form keys → sheet header names
    var keyToHeader = {
      date_requested   : 'DATE REQUESTED',
      job_id           : 'JOB ID',
      particulars      : 'PARTICULARS',
      consignee        : 'CONSIGNEE',
      mbl              : 'MBL',
      hbl              : 'HBL',
      container_number : 'CONTAINER NUMBER',
      requested_by     : 'REQUESTED BY',
      supplier_name    : "SUPPLIER'S NAME",
      account_no       : 'ACCOUNT NO.',
      bank_name        : 'BANK NAME',
      amount_2         : 'TOTAL AMOUNT',
      payment_status   : 'PAYMENT STATUS',
      timestamp        : 'TIMESTAMP'
    };

    // Build the row in the order of the sheet's headers
    var row = activeHeaders.map(function(header) {
      var key = Object.keys(keyToHeader).filter(function(k) {
        return keyToHeader[k] === header;
      })[0];
      return key && data[key] !== undefined ? data[key] : '';
    });

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({
        success      : true,
        message      : 'Row appended.',
        spreadsheet  : ss.getName(),
        sheet        : sheet.getName(),
        rowsWritten  : row.length
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ── Spreadsheet UI ─────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Data Entry Form')
    .addItem('Open Data Entry Sidebar', 'showSidebar')
    .addItem('Create / Link Google Form', 'createOrLinkForm')
    .addItem('Sync Form Questions from Sheet', 'syncQuestionsFromSheet')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Data Entry Form');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSheetHeaders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.map((h, index) => h || 'Column ' + (index + 1));
}

function submitEntry(formData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = getSheetHeaders();
  const row = headers.map(header => formData[header] || '');
  sheet.appendRow(row);
  return 'Entry saved.';
}

function createOrLinkForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getDocumentProperties();
  let formId = props.getProperty('FORM_ID');
  let form;

  if (formId) {
    try {
      form = FormApp.openById(formId);
    } catch (e) {
      formId = null;
    }
  }

  if (!formId) {
    form = FormApp.create(ss.getName() + ' Data Entry Form');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    formId = form.getId();
    props.setProperty('FORM_ID', formId);
  }

  SpreadsheetApp.getUi().alert('Google Form linked.\nForm edit URL:\n' + form.getEditUrl());
}

function syncQuestionsFromSheet() {
  const props = PropertiesService.getDocumentProperties();
  const formId = props.getProperty('FORM_ID');
  if (!formId) {
    SpreadsheetApp.getUi().alert('Walang naka-link na Google Form. Piliin ang Create / Link Google Form muna.');
    return;
  }

  const form = FormApp.openById(formId);
  const headers = getSheetHeaders();

  form.getItems().forEach(item => form.deleteItem(item));
  headers.forEach(header => {
    form.addTextItem().setTitle(header).setRequired(false);
  });

  SpreadsheetApp.getUi().alert('Na-sync ang mga tanong ng Form mula sa mga headers ng sheet.');
}
