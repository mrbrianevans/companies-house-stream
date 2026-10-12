import { Elysia } from "elysia";
import { redisClient } from "../../utils/getRedisClient";

/** Plain-text site notice. SET this key to show the banner; DEL it to hide the banner. */
export const ANNOUNCEMENT_KEY = "site:announcement";

export const announcementRouter = (app: Elysia) =>
  app.get("/announcement", async ({ set }) => {
    set.headers["cache-control"] = "no-store";
    const value = await redisClient.get(ANNOUNCEMENT_KEY);
    const text = value?.trim() ?? "";
    return { text };
  });
