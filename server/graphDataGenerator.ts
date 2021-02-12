import {Request, Response} from "express";
import {Pool} from "pg";

export const generateGraphData = async (req: Request, res: Response, pool: Pool) => {
    const timeInterval = req.query?.interval?.toString() || 'minute'
    if (!['minute', 'hour', 'day'].includes(timeInterval)) res.status(400).end("Invalid time interval")
    const cOrP: 'captured' | 'published' = 'published'
    let sqlStatement = `
    SELECT company.minute as minute, company.count as company, filing.count as filing FROM
(select date_trunc('minute' , f.published) as minute, count(f.published) as count from filing_events f group by date_trunc('minute' , f.published) order by date_trunc('minute' , f.published) desc limit 10) as filing
JOIN
(select date_trunc('minute' , c.published) as minute, count(c.published) as count from company_events c group by date_trunc('minute' , c.published) order by date_trunc('minute' , c.published) desc limit 10) AS company
ON filing.minute=company.minute
ORDER BY company.minute
;
    `.replace(/published/g, cOrP).replace(/captured/g, cOrP) // captured or published time
        .replace(/minute/g, timeInterval).replace(/hour/g, timeInterval) // time interval
        .replace(/limit [0-9]+/g, 'limit ' + (timeInterval == 'hour' ? '72' : '1000')) // set limit to 1000
    // console.log('SQL STATEMTNS: ', sqlStatement)
    try {
        // console.time("SELECT number of events GROUP BY " + timeInterval)
        const {rows} = await pool.query(sqlStatement)
        // console.timeEnd("SELECT number of events GROUP BY " + timeInterval)
        res.status(200).json(rows)
    } catch (e) {
        console.log(e)
        res.status(501).end(e.message)
    }
}
