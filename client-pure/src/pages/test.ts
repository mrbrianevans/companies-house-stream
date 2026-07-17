import "../styles/theme.scss";
import "../styles/test.css";

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

type WsUpdateMessage = {
  type: "update";
  active: SessionResponse["active_connections"];
  logs: LogEntry[];
};

type WsDeletedMessage = {
  type: "deleted";
  key?: string;
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
const wsStatusEl = document.getElementById("ws-status") as HTMLElement;
const reconnectBtn = document.getElementById("ws-reconnect-btn") as HTMLButtonElement;

const createBtn = document.getElementById("create-session-btn") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume-session-btn") as HTMLButtonElement;
const terminateBtn = document.getElementById("terminate-btn") as HTMLButtonElement;
const deleteBtn = document.getElementById("delete-btn") as HTMLButtonElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;

let currentUuid: string | null = null;
/** Stable fields from REST; live active/logs come from WebSocket snapshots. */
let sessionBase: SessionResponse | null = null;
let sessionWs: WebSocket | null = null;
let intentionalWsClose = false;

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

function setWsStatus(state: "connected" | "disconnected" | "connecting") {
  if (!wsStatusEl) return;
  wsStatusEl.hidden = false;
  wsStatusEl.dataset.state = state;
  if (state === "connected") {
    wsStatusEl.textContent = "Live updates connected";
    if (reconnectBtn) reconnectBtn.hidden = true;
  } else if (state === "connecting") {
    wsStatusEl.textContent = "Connecting live updates…";
    if (reconnectBtn) reconnectBtn.hidden = true;
  } else {
    wsStatusEl.textContent = "Live updates disconnected";
    if (reconnectBtn) reconnectBtn.hidden = false;
  }
}

function closeSessionWs() {
  intentionalWsClose = true;
  if (sessionWs) {
    try {
      sessionWs.close();
    } catch {
      // ignore
    }
    sessionWs = null;
  }
  intentionalWsClose = false;
}

function openSessionWs(uuid: string) {
  closeSessionWs();
  setWsStatus("connecting");

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  // /events prefix is stripped by Caddy (handle_path) before the API
  const ws = new WebSocket(`${protocol}://${location.host}/events/test/sessions/${uuid}/ws`);
  sessionWs = ws;

  ws.addEventListener("open", () => {
    if (sessionWs === ws) setWsStatus("connected");
  });

  ws.addEventListener("message", (event) => {
    if (sessionWs !== ws) return;
    try {
      const msg = JSON.parse(String(event.data)) as WsUpdateMessage | WsDeletedMessage;
      if (msg.type === "deleted") {
        showError(sessionError, "Session expired or was deleted.");
        localStorage.removeItem(STORAGE_KEY);
        closeSessionWs();
        return;
      }
      if (msg.type === "update" && sessionBase) {
        renderSession({
          ...sessionBase,
          active_connections: msg.active ?? [],
          logs: msg.logs ?? [],
        });
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener("close", () => {
    if (sessionWs !== ws) return;
    sessionWs = null;
    if (!intentionalWsClose && currentUuid) setWsStatus("disconnected");
  });

  ws.addEventListener("error", () => {
    // close handler will surface disconnected state
  });
}

function showCreateView() {
  closeSessionWs();
  currentUuid = null;
  sessionBase = null;
  sessionView.hidden = true;
  createView.hidden = false;
  showError(sessionError, null);
  showStatus(null);
  if (wsStatusEl) wsStatusEl.hidden = true;
  if (reconnectBtn) reconnectBtn.hidden = true;
}

function showSessionView(uuid: string) {
  currentUuid = uuid;
  createView.hidden = true;
  sessionView.hidden = false;
  apiKeyEl.textContent = uuid;
  localStorage.setItem(STORAGE_KEY, uuid);
  history.replaceState(null, "", `#${uuid}`);
  showError(createError, null);
  void loadSessionAndSubscribe(uuid);
}

async function createSession() {
  showError(createError, null);
  createBtn.disabled = true;
  try {
    const res = await fetch("/events/test/sessions", { method: "POST" });
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
    const res = await fetch(`/events/test/sessions/${encodeURIComponent(uuid)}`);
    if (res.status === 404) {
      showError(createError, "Session not found or expired.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showError(createError, body.message || `Failed to open session (${res.status})`);
      return;
    }
    const data = (await res.json()) as SessionResponse;
    currentUuid = uuid;
    createView.hidden = true;
    sessionView.hidden = false;
    apiKeyEl.textContent = uuid;
    localStorage.setItem(STORAGE_KEY, uuid);
    history.replaceState(null, "", `#${uuid}`);
    showError(createError, null);
    sessionBase = data;
    renderSession(data);
    openSessionWs(uuid);
  } catch (e) {
    showError(createError, e instanceof Error ? e.message : "Network error");
  } finally {
    resumeBtn.disabled = false;
  }
}

function renderSession(data: SessionResponse) {
  sessionBase = {
    ...data,
    // preserve stream_base_url / paths if a partial update omitted them
    stream_base_url: data.stream_base_url || sessionBase?.stream_base_url || "",
    stream_paths: data.stream_paths?.length ? data.stream_paths : (sessionBase?.stream_paths ?? []),
    created_at: data.created_at ?? sessionBase?.created_at ?? null,
    key: data.key || sessionBase?.key || currentUuid || "",
  };

  sessionMeta.textContent = sessionBase.created_at
    ? `Created ${new Date(sessionBase.created_at).toLocaleString()} · expires 24h after creation`
    : "Session active";

  if (sessionBase.stream_base_url) {
    baseUrlEl.textContent = sessionBase.stream_base_url;
    const curlExample = document.getElementById("curl-example");
    if (curlExample) {
      const key = sessionBase.key || currentUuid || "APIKEY";
      curlExample.textContent = `curl -N -u "${key}:" "${sessionBase.stream_base_url}/filings"`;
    }
  }

  streamPathsEl.replaceChildren();
  for (const path of sessionBase.stream_paths) {
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
  // Newest first in the DOM; column-reverse shows them at the visual bottom.
  const logsNewestFirst = [...data.logs].reverse();
  for (const log of logsNewestFirst) {
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

async function loadSessionAndSubscribe(uuid: string) {
  try {
    const res = await fetch(`/events/test/sessions/${encodeURIComponent(uuid)}`);
    if (res.status === 404) {
      showError(sessionError, "Session expired or was deleted.");
      localStorage.removeItem(STORAGE_KEY);
      closeSessionWs();
      return;
    }
    if (!res.ok) {
      showError(sessionError, `Failed to load session (${res.status})`);
      return;
    }
    showError(sessionError, null);
    const data = (await res.json()) as SessionResponse;
    renderSession(data);
    openSessionWs(uuid);
  } catch (e) {
    showError(sessionError, e instanceof Error ? e.message : "Network error");
    setWsStatus("disconnected");
  }
}

async function terminateConnections() {
  if (!currentUuid) return;
  terminateBtn.disabled = true;
  try {
    const res = await fetch(`/events/test/sessions/${encodeURIComponent(currentUuid)}/terminate`, {
      method: "POST",
    });
    const body = await res.json();
    if (!res.ok) {
      showError(sessionError, body.message || `Terminate failed (${res.status})`);
      return;
    }
    showStatus(`Terminated ${body.terminated ?? 0} connection(s).`);
    // Live UI comes from WebSocket snapshot publishes on terminate / disconnect.
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
    const res = await fetch(`/events/test/sessions/${encodeURIComponent(currentUuid)}`, {
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
  reconnectBtn?.addEventListener("click", () => {
    if (currentUuid) openSessionWs(currentUuid);
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
