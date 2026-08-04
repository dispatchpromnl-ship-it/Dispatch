const { getDriveClient }                                                  = require('./_lib/sheets');
const { GOOGLE_DRIVE_FOLDER_ID, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } = require('./_lib/constants');
const { cors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const { file, fileName, mimeType } = req.body || {};

    if (!file || !fileName) {
      return res.status(400).json({ success: false, error: 'File data and fileName are required.' });
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        error: `File type "${mimeType}" is not allowed. Allowed: PDF, JPG, PNG, HEIC, DOC, DOCX, XLS, XLSX.`,
      });
    }

    const buffer = Buffer.from(file, 'base64');
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds the 3MB limit.`,
      });
    }

    const drive = getDriveClient();

    // Sanitize filename: timestamp prefix to avoid collisions
    const ts = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadName = `${ts}_${safeName}`;

    // Upload with supportsAllDrives=true to enable Shared Drive support
    const response = await drive.files.create({
      requestBody: {
        name: uploadName,
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: require('stream').Readable.from(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true, // Enable Shared Drives support
    });

    const fileId = response.data.id;
    const fileUrl = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`[upload] File uploaded: ${uploadName} (${(buffer.length / 1024).toFixed(0)}KB) → ${fileId}`);

    return res.status(200).json({
      success: true,
      fileId,
      fileUrl,
      fileName: safeName,
    });

  } catch (err) {
    console.error('[upload.js] Error:', err.message);
    
    // Provide helpful error messages for common issues
    if (err.message && err.message.includes('storage quota')) {
      return res.status(500).json({
        success: false,
        error: 'Service account cannot upload to My Drive. Please use a Shared Drive folder. Contact admin to configure GOOGLE_DRIVE_FOLDER_ID with a Shared Drive folder ID.',
      });
    }
    
    if (err.message && err.message.includes('File not found')) {
      return res.status(500).json({
        success: false,
        error: 'Drive folder not found. The GOOGLE_DRIVE_FOLDER_ID may be invalid or the service account may not have access. Contact admin.',
      });
    }

    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'File upload failed. Contact admin.',
    });
  }
};
