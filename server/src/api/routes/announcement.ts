import { Elysia } from "elysia";
import { redisClient } from "../../utils/getRedisClient";

/** HTML fragment for the home-page banner. SET this key to show it; DEL it to hide it. */
export const ANNOUNCEMENT_KEY = "site:announcement";

/** Drop `<base>` tags. Other formatting is kept. */
export async function sanitizeAnnouncementHtml(html: string) {
  const response = new HTMLRewriter()
    .on("base", {
      element(element) {
        element.remove();
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
