# Google Drive Upload Setup Guide

## Problem
Service accounts cannot upload files to "My Drive" because they don't have storage quota. You'll see this error:
```
Service Accounts do not have storage quota. Leverage shared drives...
```

## Solution: Use a Shared Drive (Team Drive)

### Step 1: Create a Shared Drive
1. Go to [Google Drive](https://drive.google.com)
2. Click **Shared drives** in the left sidebar
3. Click **+ New** (top-left)
4. Name it (e.g., "Dispatcher Pro Uploads")
5. Click **Create**

### Step 2: Create a Folder in the Shared Drive
1. Open your new Shared Drive
2. Click **+ New** → **New folder**
3. Name it (e.g., "Attachments")
4. Right-click the folder → **Get link**
5. Copy the **folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/1ABC...XYZ
                                           ^^^^^^^^^^
                                           This is your folder ID
   ```

### Step 3: Share with Service Account
1. Right-click the **Shared Drive** (not the folder) → **Manage members**
2. Click **Add members**
3. Paste your service account email:
   ```
   your-service-account@your-project.iam.gserviceaccount.com
   ```
   (Find this in your `GOOGLE_CREDENTIALS` JSON under `client_email`)
4. Set permission to **Content manager** or **Manager**
5. Uncheck "Notify people" (service accounts don't read email)
6. Click **Send**

### Step 4: Update Environment Variable
In your Vercel dashboard or `.env` file:
```bash
GOOGLE_DRIVE_FOLDER_ID=1ABC...XYZ  # The folder ID from Step 2
```

Or update `api/_lib/constants.js`:
```javascript
const GOOGLE_DRIVE_FOLDER_ID = '1ABC...XYZ'; // Your Shared Drive folder ID
```

### Step 5: Redeploy
After updating the folder ID:
- **Vercel:** Redeploy from the dashboard or push to trigger auto-deploy
- **Local:** Restart `npm run dev`

---

## Verify It Works
1. Test file upload in the app
2. Check the Shared Drive folder — files should appear
3. Check Vercel logs (or local console) for `[upload] File uploaded: ...`

---

## Alternative: Use a Regular Folder with Domain-Wide Delegation
If you cannot use Shared Drives, you need **OAuth domain-wide delegation**:
1. Enable domain-wide delegation for your service account in Google Workspace Admin
2. Impersonate a real user who has Drive storage
3. Update the Drive client to use `subject: 'user@yourdomain.com'`

This is more complex — **Shared Drive is recommended**.

---

## Troubleshooting

### "File not found" error
- The folder ID is wrong, or
- Service account doesn't have access to the Shared Drive

### "Insufficient permissions" error
- Service account needs **Content Manager** role or higher on the Shared Drive

### Files upload but users can't view them
- Share the folder publicly: Right-click → Share → "Anyone with the link" → Viewer
