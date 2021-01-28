import {Request, Response} from "express";
import {Pool} from "pg";

export const generateGraphData = async (req: Request, res: Response, pool: Pool) => {
    const sqlStatement = "select date_trunc('minute' , published) as minute, count(published) from filing_events group by date_trunc('minute' , published) order by date_trunc('minute' , published) desc limit 1440;"
    try {
        const {rows} = await pool.query(sqlStatement)
        res.status(200).json(rows)
    } catch (e) {
        res.status(501).end(e)
    }
}
