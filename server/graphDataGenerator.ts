import {Request, Response} from "express";
import {Pool} from "pg";

export const generateGraphData = async (req: Request, res: Response, pool: Pool) => {
    const timeInterval = req.query?.interval?.toString() || 'minute'
    if (!['minute', 'hour', 'day'].includes(timeInterval)) res.status(400).end("Invalid time interval")
    const sqlStatement = `
    SELECT filing.minute as ${timeInterval}, company.count as company, filing.count as filing FROM
    (select date_trunc('${timeInterval}' , f.published) as minute, count(f.published) as count from filing_events f group by date_trunc('${timeInterval}' , f.published) order by date_trunc('${timeInterval}' , f.published) desc limit 1000) as filing
    ,
    (select date_trunc('${timeInterval}' , c.published) as minute, count(c.published) as count from company_events c group by date_trunc('${timeInterval}' , c.published) order by date_trunc('${timeInterval}' , c.published) desc limit 1000) AS company
    where filing.minute=company.minute
    ;
    `
    try {
        const {rows} = await pool.query(sqlStatement)
        res.status(200).json(rows)
    } catch (e) {
        console.log(e)
        res.status(501).end(e.message)
    }
}
