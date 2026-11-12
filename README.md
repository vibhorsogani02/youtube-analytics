# Creator Studio — YouTube Admin Dashboard

A responsive YouTube creator analytics dashboard built with HTML, CSS and vanilla JavaScript.

## Run locally
1. Open this folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.

No npm install is required: this project has no Node.js build step.

## Demo mode
The dashboard starts with sample/demo data. This lets you explore the UI without an API key.

## Connect a YouTube channel
1. In Google Cloud Console, create a project and enable **YouTube Data API v3**.
2. Create an API key. Restrict it to YouTube Data API v3 and, for production, restrict the key to your website/referrers.
3. In the dashboard, open **Settings**, enter the API key and your channel ID or `@handle`, then select **Save & connect**.

The API key is stored in this browser's localStorage for this front-end demo. Do not use a browser-stored API key for a public production deployment; use a secure backend/proxy instead.

## Data accuracy notes
- Channel views, public subscriber count (when available), video count, and public video statistics come from YouTube Data API v3.
- The Data API does not provide historical daily analytics. The dashboard's trend lines and several audience/traffic breakdowns are illustrative demo estimates, not official YouTube Analytics data.
- A production version should use OAuth 2.0 and the YouTube Analytics API for private channel analytics and audience reports.

## Files
- `index.html` — app structure
- `style.css` — responsive dark UI
- `app.js` — dashboard logic, demo data, charts, API integration and guided tour
