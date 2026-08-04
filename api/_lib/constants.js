// ── Shared Constants ──────────────────────────────────────────────────────────

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';

const SHEET = {
  USERS:     'USERS',
  PENDING:   'PENDING',
  DATABASE:  'DATABASE',
  AUDIT_LOG: 'AUDIT_LOG',
};

// Column definitions for each sheet
const USER_HEADERS = ['USERNAME', 'PASSWORD', 'ROLE', 'DISPLAY_NAME', 'ACTIVE', 'CREATED'];

const PENDING_COLUMNS = [
  'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
  'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
  'BANK NAME', 'TOTAL AMOUNT', 'INVOICE DUE DATE', 'TIMESTAMP',
  'SUBMITTED BY', 'STATUS', 'ADMIN_REMARKS', 'REVIEWED_BY', 'REVIEWED_AT',
  'ATTACHED FILES',
];

const DB_COLUMNS = [
  'DATE REQUESTED', 'JOB ID', 'PARTICULARS', 'CONSIGNEE', 'MBL', 'HBL',
  'CONTAINER NUMBER', 'REQUESTED BY', "SUPPLIER'S NAME", 'ACCOUNT NO.',
  'BANK NAME', 'TOTAL AMOUNT', 'INVOICE DUE DATE', 'TIMESTAMP',
  'ATTACHED FILES',
];

// Maps form field keys → column header names
const KEY_MAP = {
  date_requested:   'DATE REQUESTED',
  job_id:           'JOB ID',
  particulars:      'PARTICULARS',
  consignee:        'CONSIGNEE',
  mbl:              'MBL',
  hbl:              'HBL',
  container_number: 'CONTAINER NUMBER',
  requested_by:     'REQUESTED BY',
  supplier_name:    "SUPPLIER'S NAME",
  account_no:       'ACCOUNT NO.',
  bank_name:        'BANK NAME',
  amount_2:         'TOTAL AMOUNT',
  payment_status:   'INVOICE DUE DATE',
  timestamp:        'TIMESTAMP',
};

// Google Drive upload constraints (used by api/upload.js)
const GOOGLE_DRIVE_FOLDER_ID = '1BfH5MpVB9ace6bFsyosvNbOwFpm5JIcL';
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

module.exports = {
  SPREADSHEET_ID, SHEET,
  USER_HEADERS, PENDING_COLUMNS, DB_COLUMNS, KEY_MAP,
  GOOGLE_DRIVE_FOLDER_ID, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES,
};
