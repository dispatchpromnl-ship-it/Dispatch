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
