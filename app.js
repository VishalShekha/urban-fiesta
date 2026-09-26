/**
 * Activity Tracker — frontend
 * ---------------------------
 * No localStorage, no framework. Activities live only in Cloudflare KV;
 * this file just renders them and re-derives the remaining time every
 * second from `expiresAt`, which is a fixed point in time — so it stays
 * correct across reloads, tab closes, and different devices.
 */

const CONFIG = window.APP_CONFIG || {};
const WORKER_URL = (CONFIG.WORKER_URL || "").replace(/\/$/, "");
const API_KEY = CONFIG.API_KEY || "";

const POLL_INTERVAL_MS = 20000; // re-sync with KV periodically
const TICK_INTERVAL_MS = 1000; // re-render countdowns

let activities = [];
let serverTimeOffsetMs = 0; // (server now) - (local now), corrects clock drift

const listEl = document.getElementById("activity-list");
const emptyStateEl = document.getElementById("empty-state");
const syncStatusEl = document.getElementById("sync-status");
const cardTemplate = document.getElementById("activity-card-template");

const newActivityPanel = document.getElementById("new-activity-panel");
const newActivityForm = document.getElementById("new-activity-form");
const newActivityBtn = document.getElementById("new-activity-btn");
const cancelNewActivityBtn = document.getElementById("cancel-new-activity");

// ---------- API calls ----------

async function apiRequest(path, options = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function fetchActivities() {
  const data = await apiRequest("/api/activities");
  activities = data.activities;
  serverTimeOffsetMs = data.now - Date.now();
}

async function createActivity(name, durationSeconds) {
  const data = await apiRequest("/api/activities", {
    method: "POST",
    body: JSON.stringify({ name, durationSeconds }),
  });
  activities.push(data.activity);
}

async function resetActivity(id) {
  const data = await apiRequest(`/api/activities/${encodeURIComponent(id)}/reset`, {
    method: "POST",
  });
  const idx = activities.findIndex((a) => a.id === id);
  if (idx !== -1) activities[idx] = data.activity;
}

async function deleteActivity(id) {
  await apiRequest(`/api/activities/${encodeURIComponent(id)}`, { method: "DELETE" });
  activities = activities.filter((a) => a.id !== id);
}

// ---------- time formatting ----------

function serverNow() {
  return Date.now() + serverTimeOffsetMs;
}

function formatRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  if (totalSeconds <= 0) return "Expired";

  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");

  if (hours >= 1) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function stateFor(ratio, remainingMs) {
  if (remainingMs <= 0) return "expired";
  if (ratio <= 0.15) return "danger";
  if (ratio <= 0.5) return "warn";
  return "safe";
}

// ---------- rendering ----------

function render() {
  emptyStateEl.classList.toggle("panel-hidden", activities.length > 0);

  const existingIds = new Set(Array.from(listEl.children).map((el) => el.dataset.id));
  const nextIds = new Set(activities.map((a) => a.id));

  // remove cards for deleted activities
  for (const child of Array.from(listEl.children)) {
    if (!nextIds.has(child.dataset.id)) child.remove();
  }

  const sorted = [...activities].sort((a, b) => a.createdAt - b.createdAt);

  for (const activity of sorted) {
    let card = listEl.querySelector(`[data-id="${CSS.escape(activity.id)}"]`);
    if (!card) {
      card = cardTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.id = activity.id;
      card.querySelector(".reset-btn").addEventListener("click", () => onReset(activity.id));
      card.querySelector(".delete-btn").addEventListener("click", () => onDelete(activity.id));
      listEl.appendChild(card);
    }
    updateCard(card, activity);
  }
}

function updateCard(card, activity) {
  const remainingMs = activity.expiresAt - serverNow();
  const ratio = Math.min(1, Math.max(0, remainingMs / (activity.durationSeconds * 1000)));
  const state = stateFor(ratio, remainingMs);

  card.classList.remove("state-safe", "state-warn", "state-danger", "state-expired");
  card.classList.add(`state-${state}`);

  card.querySelector(".card-name").textContent = activity.name;
  card.querySelector(".card-time").textContent = formatRemaining(remainingMs);
  card.querySelector(".progress-fill").style.width = `${ratio * 100}%`;
}

function tick() {
  for (const activity of activities) {
    const card = listEl.querySelector(`[data-id="${CSS.escape(activity.id)}"]`);
    if (card) updateCard(card, activity);
  }
}

// ---------- sync status ----------

function setSyncStatus(text, isError = false) {
  syncStatusEl.textContent = text;
  syncStatusEl.classList.toggle("error", isError);
}

async function syncFromServer({ silent = false } = {}) {
  try {
    await fetchActivities();
    render();
    setSyncStatus(`Synced ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error(err);
    if (!silent) setSyncStatus(`Sync failed: ${err.message}`, true);
  }
}

// ---------- event handlers ----------

async function onReset(id) {
  try {
    await resetActivity(id);
    render();
  } catch (err) {
    setSyncStatus(`Reset failed: ${err.message}`, true);
  }
}

async function onDelete(id) {
  try {
    await deleteActivity(id);
    render();
  } catch (err) {
    setSyncStatus(`Delete failed: ${err.message}`, true);
  }
}

function openNewActivityPanel() {
  newActivityPanel.classList.remove("panel-hidden");
  newActivityPanel.setAttribute("aria-hidden", "false");
  document.getElementById("activity-name").focus();
}

function closeNewActivityPanel() {
  newActivityPanel.classList.add("panel-hidden");
  newActivityPanel.setAttribute("aria-hidden", "true");
  newActivityForm.reset();
}

newActivityBtn.addEventListener("click", openNewActivityPanel);
cancelNewActivityBtn.addEventListener("click", closeNewActivityPanel);

newActivityForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("activity-name").value.trim();
  const hours = Number(document.getElementById("duration-hours").value) || 0;
  const minutes = Number(document.getElementById("duration-minutes").value) || 0;
  const seconds = Number(document.getElementById("duration-seconds").value) || 0;
  const durationSeconds = hours * 3600 + minutes * 60 + seconds;

  if (!name || durationSeconds <= 0) return;

  try {
    await createActivity(name, durationSeconds);
    closeNewActivityPanel();
    render();
  } catch (err) {
    setSyncStatus(`Add failed: ${err.message}`, true);
  }
});

// ---------- boot ----------

if (!WORKER_URL) {
  setSyncStatus("Missing WORKER_URL — set it in config.js", true);
} else {
  syncFromServer();
  setInterval(() => syncFromServer({ silent: true }), POLL_INTERVAL_MS);
  setInterval(tick, TICK_INTERVAL_MS);

  // Re-sync immediately when the tab regains focus, so a change made on
  // another device shows up right away instead of waiting for the poll.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncFromServer({ silent: true });
  });
  window.addEventListener("focus", () => syncFromServer({ silent: true }));
}
