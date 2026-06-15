# VeloStock Google Sheets setup

This version removes Supabase as the live backend. The React PWA now talks to a Google Apps Script web app, and the Apps Script stores records in tabs inside one Google Sheet.

## 1. Create the Google Sheet backend

1. Create a new Google Sheet.
2. Open **Extensions > Apps Script**.
3. Delete any starter code and paste `google-apps-script/Code.gs` from this project.
4. Optional: set `API_TOKEN` at the top of `Code.gs` if you want a simple shared secret.
5. Click **Deploy > New deployment > Web app**.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone with the link**.
8. Deploy and copy the Web App URL.
9. Open the Web App URL once in your browser. It should say the VeloStock Google Sheet API is ready and create these tabs automatically:
   - users
   - rooms
   - boxes
   - inventory_items
   - stock_transactions
   - item_movements
   - box_movements
   - categories
   - user_settings

## 2. Configure the React app

Create `.env.local` in the project root:

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_GOOGLE_SCRIPT_TOKEN=
```

If you set `API_TOKEN` in `Code.gs`, put the same value in `VITE_GOOGLE_SCRIPT_TOKEN`.

Restart the development server after creating or editing `.env.local`.

```bash
npm install
npm run dev
```

## 3. What changed

- `src/supabaseClient.ts` is now a compatibility wrapper. Existing screens can still call `supabase.from(...)`, but requests go to Google Apps Script instead of Supabase.
- `src/components/Auth.tsx` now creates/signs in users in the `users` tab of the Google Sheet.
- Item images upload to Google Drive through Apps Script and the image URL is stored in the Sheet.
- `package.json` no longer requires Supabase packages.

## Important limitation

Google Sheets is good for a lightweight internal inventory app, but it is not a real replacement for Supabase security, row-level security, or high-concurrency database writes. This implementation is best for a small team/internal tool. For public apps or sensitive data, keep a real backend.
