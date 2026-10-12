import "../styles/siteNotice.css";

/**
 * Site-wide notice. The text comes from Redis key `site:announcement`,
 * via GET /events/announcement (`{ text }`). A missing, blank, or failed
 * response leaves the page with no banner. Dismissal is stored in
 * localStorage under `companies.stream.notice.dismissed.<sha256>` so a
 * different message is shown again.
 */
const ANNOUNCEMENT_URL = "/events/announcement";
const STORAGE_KEY_PREFIX = "companies.stream.notice.dismissed.";

function storageKey(hash: string) {
  return STORAGE_KEY_PREFIX + hash;
}

function isDismissed(hash: string) {
  try {
    return localStorage.getItem(storageKey(hash)) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(hash: string) {
  try {
    localStorage.setItem(storageKey(hash), "1");
  } catch {
    // Private mode and blocked storage can throw. The banner still closes for this view.
  }
}

async function hashMessage(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function announcementText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("text" in payload)) return "";
  const text = payload.text;
  return typeof text === "string" ? text.trim() : "";
}

function mountBanner(text: string, hash: string) {
  if (document.querySelector(".site-notice")) return;

  const banner = document.createElement("section");
  banner.className = "site-notice";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Site notice");

  const inner = document.createElement("div");
  inner.className = "site-notice-inner";

  const copy = document.createElement("p");
  copy.className = "site-notice-text";
  copy.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "site-notice-close";
  close.setAttribute("aria-label", "Dismiss notice");
  const closeIcon = document.createElement("span");
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "×";
  close.append(closeIcon);
  close.addEventListener("click", () => {
    rememberDismissed(hash);
    banner.remove();
  });

  inner.append(copy, close);
  banner.append(inner);
  document.body.prepend(banner);
}

async function loadAnnouncement() {
  try {
    const response = await fetch(ANNOUNCEMENT_URL, { cache: "no-store" });
    if (!response.ok) return;
    const text = announcementText(await response.json());
    if (!text) return;
    const hash = await hashMessage(text);
    if (isDismissed(hash)) return;
    mountBanner(text, hash);
  } catch {
    // Network errors, non-JSON bodies, and a missing endpoint show no banner.
  }
}

void loadAnnouncement();
