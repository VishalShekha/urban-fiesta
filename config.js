// Reference only — this is the shape of config.js, which index.html
// actually loads (see the <script> tag). You don't need to create
// config.js by hand: .github/workflows/deploy-pages.yml generates it
// automatically at deploy time from your GitHub repository Secrets
// (WORKER_URL and API_KEY). See the README, section 2.
//
// WORKER_URL: the URL of your deployed Cloudflare Worker,
//             e.g. "https://activity-tracker-api.yourname.workers.dev"
// API_KEY:    must exactly match the API_KEY secret you set with
//             `wrangler secret put API_KEY` in the worker/ folder.
//
// Note: even generated this way, the value ends up in the browser's JS
// once the site is published — a static site can't truly keep a secret
// from its own visitors. Secrets just keep it out of your git history.

window.APP_CONFIG = {
  WORKER_URL: "https://activity-tracker-api.habit-activity.workers.dev",
  API_KEY: "aee6fb18bd965cac17b2593b78f7940d95840607347561047c4969ed6b63d47d",
};
