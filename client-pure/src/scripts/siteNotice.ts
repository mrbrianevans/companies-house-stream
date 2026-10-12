import "../styles/siteNotice.css";

/**
 * Home-page notice, included only from index.html. GET /events/announcement
 * returns the HTML from Redis key `site:announcement` as the response body.
 * A missing, blank, or failed response leaves the page with no banner.
 * Dismissal is stored in localStorage at `companies.stream.notice.dismissed`,
 * with the value set to the SHA-256 of the message, so a different message is
 * shown again.
 */
const ANNOUNCEMENT_URL = "/events/announcement";
const DISMISSED_KEY = "companies.stream.notice.dismissed";

async function loadAnnouncement() {
  try {
    const response = await fetch(ANNOUNCEMENT_URL, { cache: "no-store" });
    if (!response.ok) return;

    const html = (await response.text()).trim();
    if (!html) return;

    const copy = document.createElement("div");
    copy.className = "site-notice-text";
    copy.innerHTML = html;
    if (!copy.textContent?.trim()) return;

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    try {
      if (localStorage.getItem(DISMISSED_KEY) === hash) return;
    } catch {
      // Private mode and blocked storage can throw. Show the banner anyway.
    }

    const banner = document.createElement("section");
    banner.className = "site-notice";
    const inner = document.createElement("div");
    inner.className = "site-notice-inner";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "site-notice-close";
    close.textContent = "×";
    close.addEventListener("click", () => {
      try {
        localStorage.setItem(DISMISSED_KEY, hash);
      } catch {
        // Private mode and blocked storage can throw. The banner still closes for this view.
      }
      banner.remove();
    });

    inner.append(copy, close);
    banner.append(inner);
    document.body.prepend(banner);
  } catch {
    // Network errors and a missing endpoint show no banner.
  }
}

void loadAnnouncement();
