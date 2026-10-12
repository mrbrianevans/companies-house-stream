import { Elysia } from "elysia";
import { redisClient } from "../../utils/getRedisClient";

/** HTML fragment for the home-page banner. SET this key to show it; DEL it to hide it. */
export const ANNOUNCEMENT_KEY = "site:announcement";

export const announcementRouter = (app: Elysia) =>
  app.get("/announcement", async ({ set }) => {
    set.headers["cache-control"] = "no-store";
    const value = await redisClient.get(ANNOUNCEMENT_KEY);
    return { text: value?.trim() ?? "" };
  });
