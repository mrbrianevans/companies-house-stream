import "../styles/theme.scss";
import "../styles/test.css";

const STORAGE_KEY = "test-session-uuid";
const API = "/events/test";

type LogEntry = {
  type: string;
  connId: string;
  ts: string;
  ip?: string;
  userAgent?: string;
  streamPath?: string;
  reason?: string;
};

type Session = {
  key: string;
  created_at: string | null;
  active_connections: { connId: string; connected_at: string; alive: boolean }[];
  logs: LogEntry[];
  stream_base_url: string;
  stream_paths: string[];
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const createView = $("create-view");
const sessionView = $("session-view");
const createError = $("create-error");
const sessionError = $("session-error");
const sessionMeta = $("session-meta");
const apiKeyEl = $("api-key");
const baseUrlEl = $("base-url");
const curlExample = $("curl-example");
const streamPathsEl = $<HTMLUListElement>("stream-paths");
const activeList = $<HTMLUListElement>("active-list");
const activeEmpty = $("active-empty");
const logList = $<HTMLUListElement>("log-list");
const resumeInput = $<HTMLInputElement>("resume-uuid");
const wsStatusEl = $("ws-status");
const reconnectBtn = $<HTMLButtonElement>("ws-reconnect-btn");
const createBtn = $<HTMLButtonElement>("create-session-btn");
const resumeBtn = $<HTMLButtonElement>("resume-session-btn");
const terminateBtn = $<HTMLButtonElement>("terminate-btn");
const deleteBtn = $<HTMLButtonElement>("delete-btn");
const backBtn = $<HTMLButtonElement>("back-btn");

let currentUuid: string | null = null;
let session: Session | null = null;
let sessionWs: WebSocket | null = null;
/** True while we intentionally close the WS (back / delete / replace). */
let closingWs = false;

function showError(el: HTMLElement, message: string | null) {
  el.hidden = !message;
  el.textContent = message ?? "";
}

function setDisconnected(show: boolean) {
  wsStatusEl.hidden = !show;
  reconnectBtn.hidden = !show;
  if (show) wsStatusEl.textContent = "Live updates disconnected";
}

function fillList(ul: HTMLElement, items: { text: string; title?: string }[]) {
  ul.replaceChildren(
    ...items.map(({ text, title }) => {
      const li = document.createElement("li");
      li.textContent = text;
      if (title) li.title = title;
      return li;
    }),
  );
}

async function api<T>(path: string, init?: RequestInit, errEl: HTMLElement = sessionError): Promise<T | null> {
  try {
    const res = await fetch(API + path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) showError(errEl, "Session not found or expired.");
      else showError(errEl, body.message || `Request failed (${res.status})`);
      return null;
    }
    showError(errEl, null);
    return body as T;
  } catch (e) {
    showError(errEl, e instanceof Error ? e.message : "Network error");
    return null;
  }
}

function closeSessionWs() {
  closingWs = true;
  sessionWs?.close();
  sessionWs = null;
  closingWs = false;
}

function openSessionWs(uuid: string) {
  closeSessionWs();
  setDisconnected(false);

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${location.host}${API}/sessions/${uuid}/ws`);
  sessionWs = ws;

  ws.addEventListener("message", (event) => {
    if (sessionWs !== ws) return;
    try {
      const msg = JSON.parse(String(event.data)) as {
        type: string;
        active?: Session["active_connections"];
        logs?: LogEntry[];
      };
      if (msg.type === "deleted") {
        showError(sessionError, "Session expired or was deleted.");
        localStorage.removeItem(STORAGE_KEY);
        closeSessionWs();
        return;
      }
      if (msg.type === "update" && session) {
        session = {
          ...session,
          active_connections: msg.active ?? [],
          logs: msg.logs ?? [],
        };
        renderLive(session);
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener("close", () => {
    if (sessionWs !== ws) return;
    sessionWs = null;
    if (!closingWs && currentUuid) setDisconnected(true);
  });
}

function showCreateView() {
  closeSessionWs();
  currentUuid = null;
  session = null;
  sessionView.hidden = true;
  createView.hidden = false;
  showError(sessionError, null);
  setDisconnected(false);
}

function renderMeta(data: Session) {
  apiKeyEl.textContent = data.key;
  sessionMeta.textContent = data.created_at
    ? `Created ${new Date(data.created_at).toLocaleString()} · expires 24h after creation`
    : "Session active";

  if (data.stream_base_url) {
    baseUrlEl.textContent = data.stream_base_url;
    curlExample.textContent = `curl -N -u "${data.key}:" "${data.stream_base_url}/filings"`;
  }

  streamPathsEl.replaceChildren(
    ...data.stream_paths.map((path) => {
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = `/${path}`;
      li.appendChild(code);
      return li;
    }),
  );
}

function renderLive(data: Session) {
  activeEmpty.hidden = data.active_connections.length > 0;
  fillList(
    activeList,
    data.active_connections.map((c) => ({
      text: `${c.connId} · ${c.alive ? "alive" : "tracked"} · since ${new Date(c.connected_at).toLocaleTimeString()}`,
    })),
  );

  // Newest first in DOM; CSS column-reverse puts newest at visual bottom
  fillList(
    logList,
    [...data.logs].reverse().map((log) => ({
      text: [
        log.ts ? new Date(log.ts).toLocaleTimeString() : "?",
        log.type,
        log.connId,
        log.streamPath ? `/${log.streamPath}` : "",
        log.ip || "",
        log.reason || "",
      ]
        .filter(Boolean)
        .join(" · "),
      title: log.userAgent,
    })),
  );
}

async function enterSession(uuid: string, errEl: HTMLElement = sessionError) {
  currentUuid = uuid;
  createView.hidden = true;
  sessionView.hidden = false;
  apiKeyEl.textContent = uuid;
  localStorage.setItem(STORAGE_KEY, uuid);
  history.replaceState(null, "", `#${uuid}`);
  showError(createError, null);

  const data = await api<Session>(`/sessions/${encodeURIComponent(uuid)}`, undefined, errEl);
  if (!data) {
    if (errEl === sessionError) localStorage.removeItem(STORAGE_KEY);
    return;
  }

  session = data;
  renderMeta(data);
  renderLive(data);
  openSessionWs(uuid);
}

async function createSession() {
  showError(createError, null);
  createBtn.disabled = true;
  try {
    const body = await api<{ key: string }>("/sessions", { method: "POST" }, createError);
    if (body?.key) await enterSession(body.key, createError);
  } finally {
    createBtn.disabled = false;
  }
}

async function resumeSession() {
  const uuid = resumeInput.value.trim();
  if (!uuid) {
    showError(createError, "Paste a session UUID first.");
    return;
  }
  showError(createError, null);
  resumeBtn.disabled = true;
  try {
    await enterSession(uuid, createError);
  } finally {
    resumeBtn.disabled = false;
  }
}

async function terminateConnections() {
  if (!currentUuid) return;
  terminateBtn.disabled = true;
  try {
    await api(`/sessions/${encodeURIComponent(currentUuid)}/terminate`, { method: "POST" });
    // Live UI updates via WebSocket snapshots
  } finally {
    terminateBtn.disabled = false;
  }
}

async function deleteSession() {
  if (!currentUuid) return;
  deleteBtn.disabled = true;
  try {
    const res = await fetch(`${API}/sessions/${encodeURIComponent(currentUuid)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      showError(sessionError, body.message || `Delete failed (${res.status})`);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    history.replaceState(null, "", location.pathname);
    showCreateView();
  } catch (e) {
    showError(sessionError, e instanceof Error ? e.message : "Network error");
  } finally {
    deleteBtn.disabled = false;
  }
}

async function copyFromTarget(button: HTMLButtonElement) {
  const el = document.getElementById(button.dataset.copyTarget || "");
  if (!el) return;
  try {
    await navigator.clipboard.writeText(el.textContent || "");
    const prev = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = prev;
    }, 1200);
  } catch {
    showError(sessionError, "Could not copy to clipboard");
  }
}

function init() {
  createBtn.addEventListener("click", () => void createSession());
  resumeBtn.addEventListener("click", () => void resumeSession());
  resumeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void resumeSession();
  });
  terminateBtn.addEventListener("click", () => void terminateConnections());
  deleteBtn.addEventListener("click", () => void deleteSession());
  backBtn.addEventListener("click", () => {
    history.replaceState(null, "", location.pathname);
    showCreateView();
  });
  reconnectBtn.addEventListener("click", () => {
    if (currentUuid) openSessionWs(currentUuid);
  });
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy-target]")) {
    btn.addEventListener("click", () => void copyFromTarget(btn));
  }

  const initial = location.hash.replace(/^#/, "").trim() || localStorage.getItem(STORAGE_KEY);
  if (initial) {
    resumeInput.value = initial;
    void resumeSession();
  }
}

init();
