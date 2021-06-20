import { Pool } from "pg";
import { Request, Response } from "express";

const generateGraphData = async (req: Request, res: Response) => {
  const pool = new Pool();
  const timeInterval =
    req.query?.interval?.toString() ||
    req.body?.interval?.toString() ||
    "minute";
  if (!["minute", "hour", "day", "month"].includes(timeInterval))
    res.status(400).end("Invalid time interval");
  let sqlStatement = `
    SELECT coalesce(company.minute, filing.minute) as minute, company.count as company, filing.count as filing FROM
(select date_trunc('minute' , f.published) as minute, count(f.published) as count from filing_events f group by date_trunc('minute' , f.published) order by date_trunc('minute' , f.published) desc limit 10) as filing
FULL OUTER JOIN
(select date_trunc('minute' , c.published) as minute, count(c.published) as count from company_events c group by date_trunc('minute' , c.published) order by date_trunc('minute' , c.published) desc limit 10) AS company
ON filing.minute=company.minute
WHERE coalesce(company.minute, filing.minute) IS NOT NULL
ORDER BY coalesce(company.minute, filing.minute)
;
    `
    .replace(/minute/g, timeInterval)
    .replace(/hour/g, timeInterval) // time interval
    .replace(
      /limit [0-9]+/g,
      "limit " + (timeInterval == "minute" ? "1000" : "48")
    ); // set limit to 1000
  // console.log('SQL STATEMTNS: ', sqlStatement)
  try {
    console.time("SELECT number of events GROUP BY " + timeInterval);
    const { rows } = await pool.query(sqlStatement);
    console.timeEnd("SELECT number of events GROUP BY " + timeInterval);
    res.status(200).json(rows);
    return;
  } catch (e) {
    console.log("Could not select events frequency from database", e.message);
    res.status(501).json({ message: e.message });
    return;
  }
};

export { generateGraphData };
