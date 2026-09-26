// Copy this file to config.js and fill in your own values.
// config.js is what index.html actually loads (see the <script> tag).
//
// WORKER_URL: the URL of your deployed Cloudflare Worker,
//             e.g. "https://activity-tracker-api.yourname.workers.dev"
// API_KEY:    must exactly match the API_KEY secret you set with
//             `wrangler secret put API_KEY` in the worker/ folder.
//
// Note: this file is loaded by the browser, so its contents are visible
// to anyone who views your site's source. That's an acceptable trade-off
// for a personal tool, but if you'd rather not ship the key at all, keep
// the repo private, or add IP/Access rules on the Worker instead.

window.APP_CONFIG = {
  WORKER_URL: "https://activity-tracker-api.habit-activity.workers.dev",
  API_KEY: "aee6fb18bd965cac17b2593b78f7940d95840607347561047c4969ed6b63d47d",
};
