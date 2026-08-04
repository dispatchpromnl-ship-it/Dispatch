# OneDrive File Upload Setup Guide
# ALWEN DISPATCHER PRO — Microsoft Graph API Integration

Gagamitin natin ang iyong existing OneDrive subscription para i-save ang mga
attached files mula sa system. One-time setup lang ito.

---

## Ano ang Kailangan Mo

- Microsoft account na may OneDrive subscription
- Access sa https://portal.azure.com (libre, kasama sa Microsoft account mo)
- Mga 15–20 minuto para sa buong setup

---

## BAHAGI 1 — Azure App Registration

### Hakbang 1: Pumunta sa Azure Portal

1. Buksan ang browser, pumunta sa: **https://portal.azure.com**
2. Mag-sign in gamit ang **parehong Microsoft account** na may OneDrive subscription mo
3. Sa search bar sa taas, i-type: `App registrations`
4. I-click ang **"App registrations"** sa mga resulta

---

### Hakbang 2: Gumawa ng Bagong App

1. I-click ang **"+ New registration"** (nasa taas-kaliwa)
2. Punan ang form:
   - **Name:** `Dispatcher Pro Upload` (o anumang pangalan)
   - **Supported account types:** Piliin ang **"Accounts in any organizational directory and personal Microsoft accounts"**
   - **Redirect URI:** Piliin ang `Web`, i-type ang: `http://localhost`
3. I-click ang **"Register"** button sa ibaba

> ✅ Mayroon ka na ngayong bagong app. Huwag isara ang page na ito.

---

### Hakbang 3: Kopyahin ang Client ID

Sa Overview page ng app mo:

1. Hanapin ang **"Application (client) ID"**
2. I-copy at i-save sa notepad:
   ```
   CLIENT_ID = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

---

### Hakbang 4: Gumawa ng Client Secret

1. Sa kaliwang menu, i-click ang **"Certificates & secrets"**
2. I-click ang **"+ New client secret"**
3. Punan:
   - **Description:** `dispatch-upload`
   - **Expires:** Piliin ang **"24 months"** (pinaka-matagal na available)
4. I-click ang **"Add"**
5. **MAHALAGA:** Makikita mo ang secret value sa **"Value"** column
   - I-copy AGAD at i-save sa notepad — **hindi na ito makikita ulit!**
   ```
   CLIENT_SECRET = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

### Hakbang 5: I-set ang API Permissions

1. Sa kaliwang menu, i-click ang **"API permissions"**
2. I-click ang **"+ Add a permission"**
3. I-click ang **"Microsoft Graph"**
4. I-click ang **"Delegated permissions"**
5. Sa search box, i-type: `Files.ReadWrite`
6. Lagyan ng check ang:
   - ✅ `Files.ReadWrite` — para mag-upload ng files
   - ✅ `offline_access` — para sa refresh token (hindi mag-eexpire)
7. I-click ang **"Add permissions"**

> Ang screen mo dapat ganito ang hitsura:
> - Microsoft Graph / Files.ReadWrite / Delegated / Granted
> - Microsoft Graph / offline_access / Delegated / Granted

---

## BAHAGI 2 — Kumuha ng Refresh Token

Ito ang pinaka-importanteng hakbang. Ito ang mag-aallow sa server na mag-upload
nang walang kailangan pang mag-login ulit.

### Hakbang 6: I-construct ang Authorization URL

Palitan ang `YOUR_CLIENT_ID` ng Client ID na kinopya mo sa Hakbang 3:

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost&response_mode=query&scope=Files.ReadWrite%20offline_access&prompt=consent
```

**Halimbawa** (kung ang Client ID mo ay `abc123`):
```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=abc123&response_type=code&redirect_uri=http%3A%2F%2Flocalhost&response_mode=query&scope=Files.ReadWrite%20offline_access&prompt=consent
```

---

### Hakbang 7: I-authorize ang App

1. I-paste ang URL sa browser address bar at pindutin Enter
2. Mag-sign in gamit ang iyong Microsoft account
3. I-click ang **"Accept"** para i-grant ang permissions
4. Ire-redirect ka sa `http://localhost/...` — **mag-eerror ito, normal lang!**
5. Tingnan ang address bar ng browser. Makikita mo ang URL na ganito:
   ```
   http://localhost/?code=M.R3_BAY.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&session_state=...
   ```
6. Kopyahin ang **code value** — lahat ng text pagkatapos ng `code=` hanggang sa `&session_state`:
   ```
   AUTH_CODE = M.R3_BAY.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> ⚠️ Ang auth code ay mag-eexpire sa loob ng **5 minuto**. Gawin agad ang susunod na hakbang!

---

### Hakbang 8: I-exchange ang Code para sa Refresh Token

Buksan ang **PowerShell** o **Command Prompt** at i-run ang command na ito.
Palitan ang mga placeholder:

```powershell
$body = @{
    client_id     = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
    code          = "YOUR_AUTH_CODE"
    redirect_uri  = "http://localhost"
    grant_type    = "authorization_code"
}
$response = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/common/oauth2/v2.0/token" -Body $body
$response | ConvertTo-Json
```

**O kung gusto mo gamitin ang curl:**
```bash
curl -X POST https://login.microsoftonline.com/common/oauth2/v2.0/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTH_CODE" \
  -d "redirect_uri=http://localhost" \
  -d "grant_type=authorization_code"
```

Sa response, hanapin at kopyahin ang `refresh_token`:
```json
{
  "access_token": "...",
  "refresh_token": "M.R3_BAY.xxxxxxxx...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 3600
}
```

I-save:
```
REFRESH_TOKEN = M.R3_BAY.xxxxxxxx...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## BAHAGI 3 — I-prepare ang OneDrive Folder

### Hakbang 9: Gumawa ng Upload Folder sa OneDrive

1. Pumunta sa **https://onedrive.live.com**
2. Mag-sign in sa iyong Microsoft account
3. I-click ang **"+ New"** → **"Folder"**
4. Pangalanan ito ng: `Dispatcher Attachments`
5. Buksan ang folder na ginawa mo
6. Tingnan ang URL sa browser — makikita mo ang folder ID:
   ```
   https://onedrive.live.com/?id=ABC123DEF456!789&cid=ABC123DEF456
   ```
   Ang folder ID ay ang number pagkatapos ng `!` — sa halimbawa: `789`

   O mas madaling paraan:
   - Right-click ang folder → **"Embed"** → makikita ang ID sa embed code
   - O gamitin ang Graph Explorer sa susunod na hakbang para kumuha ng folder ID

---

### Hakbang 10: Kumuha ng Folder ID gamit ang Graph Explorer (Madaling Paraan)

1. Pumunta sa **https://developer.microsoft.com/en-us/graph/graph-explorer**
2. I-click ang **"Sign in to Graph Explorer"** — gamitin ang iyong Microsoft account
3. Sa request URL box, i-type:
   ```
   https://graph.microsoft.com/v1.0/me/drive/root/children
   ```
4. I-click ang **"Run query"**
5. Sa response, hanapin ang folder na `Dispatcher Attachments`
6. Kopyahin ang `id` value nito:
   ```json
   {
     "name": "Dispatcher Attachments",
     "id": "ABC123DEF456789!012"
   }
   ```

I-save:
```
FOLDER_ID = ABC123DEF456789!012
```

---

## BAHAGI 4 — I-configure ang Vercel Environment Variables

### Hakbang 11: I-add sa Vercel Dashboard

1. Pumunta sa **https://vercel.com/dashboard**
2. I-click ang iyong project (Dispatch)
3. I-click ang **"Settings"** tab
4. I-click ang **"Environment Variables"** sa kaliwang menu
5. I-add ang bawat variable (i-click ang "+ Add" para sa bawat isa):

| Variable Name | Value |
|---|---|
| `ONEDRIVE_CLIENT_ID` | Client ID mula sa Hakbang 3 |
| `ONEDRIVE_CLIENT_SECRET` | Client Secret mula sa Hakbang 4 |
| `ONEDRIVE_REFRESH_TOKEN` | Refresh Token mula sa Hakbang 8 |
| `ONEDRIVE_FOLDER_ID` | Folder ID mula sa Hakbang 10 |

6. Para sa bawat variable, siguraduhing naka-check ang lahat ng environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

7. I-click ang **"Save"** pagkatapos ng bawat variable

---

### Hakbang 12: Para sa Local Development (.env file)

Gumawa ng `.env` file sa root ng project (nasa `.gitignore` na ito, hindi ma-commit):

```env
ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONEDRIVE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONEDRIVE_REFRESH_TOKEN=M.R3_BAY.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONEDRIVE_FOLDER_ID=ABC123DEF456789!012
```

---

## BAHAGI 5 — I-deploy at I-test

### Hakbang 13: I-trigger ang Redeploy

Pagkatapos i-save ang environment variables sa Vercel:

1. Pumunta sa **"Deployments"** tab sa Vercel
2. I-click ang pinakabagong deployment
3. I-click ang **"..."** menu → **"Redeploy"**
4. O mag-push ng bagong commit sa GitHub para auto-deploy

---

### Hakbang 14: I-test ang Upload

1. Buksan ang system sa browser
2. Punan ang isang request form
3. Mag-attach ng test file (PDF o image)
4. I-submit
5. Tingnan ang iyong OneDrive — dapat makita ang file sa `Dispatcher Attachments` folder
6. Tingnan ang Google Sheet — dapat may link sa "ATTACHED FILES" column

---

## Troubleshooting

### "invalid_client" error sa token exchange
- Mali ang Client ID o Client Secret — i-double check
- Siguraduhing walang extra spaces sa copied values

### "invalid_grant" error
- Expired na ang auth code — ulitin ang Hakbang 7 at 8 agad (may 5 minuto lang)
- O wrong redirect_uri — dapat `http://localhost` (lowercase, walang slash sa dulo)

### "Access token has expired" error sa upload
- Siguraduhing tama ang `ONEDRIVE_REFRESH_TOKEN` sa Vercel env vars
- Ang refresh token ay basta-basta hindi mag-eexpire maliban kung:
  - Hindi nagamit ng 90 araw
  - Binago ang password ng Microsoft account
  - Nire-revoke sa Azure portal

### "itemNotFound" error
- Mali ang `ONEDRIVE_FOLDER_ID` — ulitin ang Hakbang 10
- Siguraduhing hindi na-delete ang folder sa OneDrive

### File na-upload sa OneDrive pero walang link sa Google Sheet
- Normal ito kung nagre-redirect ka sa isang private file
- Kailangan i-share ang folder: Right-click → Share → "Anyone with the link" → Viewer

---

## Security Notes

- Huwag i-commit ang `.env` file sa GitHub (nasa `.gitignore` na)
- Huwag ibahagi ang Client Secret at Refresh Token
- Ang refresh token ay may access sa iyong OneDrive — i-keep itong private
- Kung suspect na na-leak ang tokens, pumunta sa Azure Portal → App registrations → iyong app → Certificates & secrets → I-delete ang lumang secret at gumawa ng bago, tapos kumuha ng bagong refresh token

---

## Summary ng mga Kinukuhang Values

Kapag tapos na ang setup, dapat mayroon kang:

```
✅ ONEDRIVE_CLIENT_ID      = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ ONEDRIVE_CLIENT_SECRET  = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
✅ ONEDRIVE_REFRESH_TOKEN  = M.R3_BAY.xxxxxxxx...long string...
✅ ONEDRIVE_FOLDER_ID      = ABC123DEF456789!012
```

Pagkatapos i-add ang mga ito sa Vercel at ma-redeploy, pwede na nating i-enable
ang file upload feature sa system at alisin ang "Coming Soon" message.

Sabihan ang developer (Kiro) kapag tapos na ang setup para i-update ang code!
