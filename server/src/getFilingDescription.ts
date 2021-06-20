import { Pool } from "pg";
import { Request, Response } from "express";
import { getValue, setValue } from "./asyncRedis";

export const getFilingDescription = async (req: Request, res: Response) => {
  if (
    req.method !== "POST" ||
    req.headers["content-type"].toLowerCase() !== "application/json"
  ) {
    res.status(400).json({
      message:
        "Server only accepts POST requests with application/json content"
    });
    return;
  }
  const requestBody = req.body;
  const description_values = requestBody.description_values;
  const description = requestBody.description?.toString();
  if (!description) {
    res.status(400).json({ message: "description not specified (required)" });
    return;
  }
  console.time("Format filing description");
  // first try get it from redis, ON cache miss: fallback to postgres
  let descriptionFormat: string | null = await getValue(description);
  if (descriptionFormat === null) {
    try {
      const pool = new Pool();
      const result = await pool
        .query(
          "SELECT value FROM filing_history_descriptions WHERE key=$1 LIMIT 1",
          [description]
        );
      await pool.end();
      if (result && result?.rowCount === 1) {
        descriptionFormat = result.rows[0]["value"];
        await setValue(description, descriptionFormat);
      }
    } catch (e) {
      console.log("Failed to query postgres for filing description:", e.message);
    }

  }
  if (typeof descriptionFormat !== "string")
    // can't find description in database (rare)
    res.status(404).end();
  else {
    let formattedDescription = descriptionFormat.replace(/{([a-z_]+)}/g, (s) =>
      description_values
        ? description_values[s.slice(1, s.length - 1)] || ""
        : ""
    );
    // console.log('FormattedDescription:',formattedDescription)
    res.status(200).json({ formattedDescription });
  }
  console.timeEnd("Format filing description");
};
