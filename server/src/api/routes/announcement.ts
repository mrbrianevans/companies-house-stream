import { Elysia } from "elysia";
import { redisClient } from "../../utils/getRedisClient";

/** HTML fragment for the home-page banner. SET this key to show it; DEL it to hide it. */
export const ANNOUNCEMENT_KEY = "site:announcement";

/** Drop tags that can navigate the page or retarget its links. Formatting tags are kept. */
export async function sanitizeAnnouncementHtml(html: string) {
  const response = new HTMLRewriter()
    .on("base", {
      element(element) {
        element.remove();
      },
    })
    .on("meta", {
      element(element) {
        const httpEquiv = element.getAttribute("http-equiv");
        if (httpEquiv?.trim().toLowerCase() === "refresh") element.remove();
      },
    })
    .transform(new Response(html));
  return (await response.text()).trim();
}

export const announcementRouter = (app: Elysia) =>
  app.get("/announcement", async ({ set }) => {
    set.headers["cache-control"] = "no-store";
    const value = await redisClient.get(ANNOUNCEMENT_KEY);
    const text = value ? await sanitizeAnnouncementHtml(value) : "";
    return { text };
  });
