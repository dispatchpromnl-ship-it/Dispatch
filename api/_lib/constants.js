// ── Shared Constants ──────────────────────────────────────────────────────────

const SPREADSHEET_ID = '1dOlu7346uncivzoAhGKXtR4HbwTSjzQNUilOzhYUB_g';

const SHEET = {
  USERS:     'USERS',
  PENDING:   'PENDING',
  DATABASE:  'DATABASE',
  AUDIT_LOG: 'AUDIT_LOG',
};

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
  payment_status:   'PAYMENT STATUS',
  timestamp:        'TIMESTAMP',
};

module.exports = { SPREADSHEET_ID, SHEET, PENDING_COLUMNS, DB_COLUMNS, KEY_MAP };
