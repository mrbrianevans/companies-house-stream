import "../styles/theme.scss";
import "../styles/test.css";

const POLL_MS = 3000;
const STORAGE_KEY = "test-session-uuid";

type LogEntry = {
  type: string;
  connId: string;
  ts: string;
  ip?: string;
  userAgent?: string;
  streamPath?: string;
  reason?: string;
};

type SessionResponse = {
  key: string;
  created_at: string | null;
  active_connections: {
    connId: string;
    connected_at: string;
    alive: boolean;
  }[];
  logs: LogEntry[];
  stream_base_url: string;
  stream_paths: string[];
};

const createView = document.getElementById("create-view") as HTMLElement;
const sessionView = document.getElementById("session-view") as HTMLElement;
const createError = document.getElementById("create-error") as HTMLElement;
const sessionError = document.getElementById("session-error") as HTMLElement;
const sessionStatus = document.getElementById("session-status") as HTMLElement;
const sessionMeta = document.getElementById("session-meta") as HTMLElement;
const apiKeyEl = document.getElementById("api-key") as HTMLElement;
const baseUrlEl = document.getElementById("base-url") as HTMLElement;
const streamPathsEl = document.getElementById("stream-paths") as HTMLUListElement;
const activeList = document.getElementById("active-list") as HTMLUListElement;
const activeEmpty = document.getElementById("active-empty") as HTMLElement;
const logList = document.getElementById("log-list") as HTMLUListElement;
const resumeInput = document.getElementById("resume-uuid") as HTMLInputElement;

const createBtn = document.getElementById("create-session-btn") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume-session-btn") as HTMLButtonElement;
const terminateBtn = document.getElementById("terminate-btn") as HTMLButtonElement;
const deleteBtn = document.getElementById("delete-btn") as HTMLButtonElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;

let currentUuid: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function showError(el: HTMLElement, message: string | null) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function showStatus(message: string | null) {
  if (!message) {
    sessionStatus.hidden = true;
    sessionStatus.textContent = "";
    return;
  }
  sessionStatus.hidden = false;
  sessionStatus.textContent = message;
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function showCreateView() {
  stopPolling();
  currentUuid = null;
  sessionView.hidden = true;
  createView.hidden = false;
  showError(sessionError, null);
  showStatus(null);
}

function showSessionView(uuid: string) {
  currentUuid = uuid;
  createView.hidden = true;
  sessionView.hidden = false;
  apiKeyEl.textContent = uuid;
  localStorage.setItem(STORAGE_KEY, uuid);
  history.replaceState(null, "", `#${uuid}`);
  showError(createError, null);
  void refreshSession();
  stopPolling();
  pollTimer = setInterval(() => void refreshSession(), POLL_MS);
}

async function createSession() {
  showError(createError, null);
  createBtn.disabled = true;
  try {
    const res = await fetch("/test/sessions", { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      showError(createError, body.message || `Failed to create session (${res.status})`);
      return;
    }
    showSessionView(body.key as string);
  } catch (e) {
    showError(createError, e instanceof Error ? e.message : "Network error");
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
    const res = await fetch(`/test/sessions/${encodeURIComponent(uuid)}`);
    if (res.status === 404) {
      showError(createError, "Session not found or expired.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showError(createError, body.message || `Failed to open session (${res.status})`);
      return;
    }
    showSessionView(uuid);
  } catch (e) {
    showError(createError, e instanceof Error ? e.message : "Network error");
  } finally {
    resumeBtn.disabled = false;
  }
}

function renderSession(data: SessionResponse) {
  sessionMeta.textContent = data.created_at
    ? `Created ${new Date(data.created_at).toLocaleString()} · expires 24h after creation`
    : "Session active";

  if (data.stream_base_url) {
    baseUrlEl.textContent = data.stream_base_url;
    const curlExample = document.getElementById("curl-example");
    if (curlExample) {
      const key = data.key || currentUuid || "APIKEY";
      curlExample.textContent = `curl -N -u "${key}:" "${data.stream_base_url}/filings"`;
    }
  }

  streamPathsEl.replaceChildren();
  for (const path of data.stream_paths) {
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = `/${path}`;
    li.appendChild(code);
    streamPathsEl.appendChild(li);
  }

  activeList.replaceChildren();
  if (!data.active_connections.length) {
    activeEmpty.hidden = false;
  } else {
    activeEmpty.hidden = true;
    for (const conn of data.active_connections) {
      const li = document.createElement("li");
      const alive = conn.alive ? "alive" : "tracked";
      li.textContent = `${conn.connId} · ${alive} · since ${new Date(conn.connected_at).toLocaleTimeString()}`;
      activeList.appendChild(li);
    }
  }

  logList.replaceChildren();
  for (const log of data.logs) {
    const li = document.createElement("li");
    const parts = [
      log.ts ? new Date(log.ts).toLocaleTimeString() : "?",
      log.type,
      log.connId,
      log.streamPath ? `/${log.streamPath}` : "",
      log.ip || "",
      log.reason || "",
    ].filter(Boolean);
    li.textContent = parts.join(" · ");
    if (log.userAgent) li.title = log.userAgent;
    logList.appendChild(li);
  }
}

async function refreshSession() {
  if (!currentUuid) return;
  try {
    const res = await fetch(`/test/sessions/${encodeURIComponent(currentUuid)}`);
    if (res.status === 404) {
      showError(sessionError, "Session expired or was deleted.");
      stopPolling();
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (!res.ok) {
      showError(sessionError, `Failed to refresh (${res.status})`);
      return;
    }
    showError(sessionError, null);
    const data = (await res.json()) as SessionResponse;
    renderSession(data);
  } catch (e) {
    showError(sessionError, e instanceof Error ? e.message : "Network error");
  }
}

async function terminateConnections() {
  if (!currentUuid) return;
  terminateBtn.disabled = true;
  try {
    const res = await fetch(`/test/sessions/${encodeURIComponent(currentUuid)}/terminate`, {
      method: "POST",
    });
    const body = await res.json();
    if (!res.ok) {
      showError(sessionError, body.message || `Terminate failed (${res.status})`);
      return;
    }
    showStatus(`Terminated ${body.terminated ?? 0} connection(s).`);
    await refreshSession();
  } catch (e) {
    showError(sessionError, e instanceof Error ? e.message : "Network error");
  } finally {
    terminateBtn.disabled = false;
  }
}

async function deleteSession() {
  if (!currentUuid) return;
  deleteBtn.disabled = true;
  try {
    const res = await fetch(`/test/sessions/${encodeURIComponent(currentUuid)}`, {
      method: "DELETE",
    });
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
  const targetId = button.dataset.copyTarget;
  if (!targetId) return;
  const el = document.getElementById(targetId);
  if (!el) return;
  const text = el.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
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

  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy-target]")) {
    btn.addEventListener("click", () => void copyFromTarget(btn));
  }

  const hashUuid = location.hash.replace(/^#/, "").trim();
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = hashUuid || stored;
  if (initial) {
    resumeInput.value = initial;
    void resumeSession();
  }
}

init();
