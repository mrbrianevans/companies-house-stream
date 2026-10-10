import "../styles/siteNotice.css";

type CodePart = { readonly code: string };
type LinkPart = { readonly label: string; readonly href: string };
type NoticePart = string | CodePart | LinkPart;

/**
 * Site-wide notice banner.
 *
 * Edit this object to change the copy or links. Set `enabled` to false to
 * hide the banner on the next deploy. Bump `version` when the message changes
 * so visitors who dismissed an older banner see the new one. The dismiss flag
 * is stored in localStorage under `companies.stream.notice.dismissed.<version>`.
 */
export const siteNotice = {
  enabled: true,
  version: "psc-bulk-load-2026-10-13",
  headline: "Companies House is running a bulk load on the PSC stream.",
  body: [
    "From 08:00 UK time on Tuesday 13 October 2026, Companies House is re-sending every PSC record on the stream (about 15–20 days) to add a new ",
    { code: "links.persons_with_significant_control.notifications" },
    " field. Expect a very high volume of persons-with-significant-control events. If your consumer couldn't keep up and missed events, complete PSC data is available from ",
    { label: "Companies Catalogue", href: "https://companiescatalogue.co.uk" },
    ". ",
    {
      label: "More details",
      href: "https://forum.companieshouse.gov.uk/t/loading-of-new-persons-with-significant-control-data/13064",
    },
    ".",
  ],
} as const satisfies {
  enabled: boolean;
  version: string;
  headline: string;
  body: readonly NoticePart[];
};

const STORAGE_KEY_PREFIX = "companies.stream.notice.dismissed.";

function storageKey(version: string) {
  return STORAGE_KEY_PREFIX + version;
}

function isDismissed(version: string) {
  try {
    return localStorage.getItem(storageKey(version)) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(version: string) {
  try {
    localStorage.setItem(storageKey(version), "1");
  } catch {
    // Private mode and blocked storage can throw. The banner still closes for this view.
  }
}

function isCodePart(part: NoticePart): part is CodePart {
  return typeof part === "object" && "code" in part;
}

function isLinkPart(part: NoticePart): part is LinkPart {
  return typeof part === "object" && "href" in part;
}

function appendPart(parent: ParentNode, part: NoticePart) {
  if (typeof part === "string") {
    parent.append(document.createTextNode(part));
    return;
  }
  if (isCodePart(part)) {
    const code = document.createElement("code");
    code.textContent = part.code;
    parent.append(code);
    return;
  }
  if (isLinkPart(part)) {
    const link = document.createElement("a");
    link.href = part.href;
    link.textContent = part.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    parent.append(link);
  }
}

function mountSiteNotice() {
  if (!siteNotice.enabled || isDismissed(siteNotice.version)) return;
  if (document.querySelector(".site-notice")) return;

  const banner = document.createElement("section");
  banner.className = "site-notice";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Site notice");

  const inner = document.createElement("div");
  inner.className = "site-notice-inner";

  const copy = document.createElement("div");
  copy.className = "site-notice-copy";

  const headline = document.createElement("p");
  headline.className = "site-notice-headline";
  headline.textContent = siteNotice.headline;

  const body = document.createElement("p");
  body.className = "site-notice-body";
  for (const part of siteNotice.body) appendPart(body, part);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "site-notice-close";
  close.setAttribute("aria-label", "Dismiss notice");
  const closeIcon = document.createElement("span");
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "×";
  close.append(closeIcon);
  close.addEventListener("click", () => {
    rememberDismissed(siteNotice.version);
    banner.remove();
  });

  copy.append(headline, body);
  inner.append(copy, close);
  banner.append(inner);
  document.body.prepend(banner);
}

mountSiteNotice();
