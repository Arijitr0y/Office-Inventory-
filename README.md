# VeloStock Inventory PWA

VeloStock is a React + TypeScript + Vite inventory management PWA. This version uses **Google Sheets as the database** through a **Google Apps Script Web App** instead of Supabase.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Google Sheets backend setup

Read `GOOGLE_SHEETS_SETUP.md` for the full setup.

Quick version:

1. Create a Google Sheet.
2. Open **Extensions > Apps Script**.
3. Paste `google-apps-script/Code.gs`.
4. Deploy as a **Web app**.
5. Set **Execute as** to **Me**.
6. Set **Who has access** to **Anyone with the link**.
7. Copy the Web App URL into `.env.local`:

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_GOOGLE_SCRIPT_TOKEN=
```

Restart the dev server after editing `.env.local`.

## Backend tabs created automatically

The Apps Script creates these Google Sheet tabs:

- `users`
- `rooms`
- `boxes`
- `inventory_items`
- `stock_transactions`
- `item_movements`
- `box_movements`
- `categories`
- `user_settings`

## Notes

- The old Supabase-style calls are kept through a compatibility wrapper in `src/supabaseClient.ts`, but they now call Google Apps Script.
- This is suitable for an internal lightweight inventory tool.
- Google Sheets is not a full database replacement for high-traffic or sensitive public apps.
