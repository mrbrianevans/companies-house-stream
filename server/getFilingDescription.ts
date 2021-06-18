import {Pool} from "pg";
import {Request, Response} from "express";

export const getFilingDescription = async (req: Request, res: Response) => {
    if (req.method !== 'POST' || req.headers['content-type'].toLowerCase() !== 'application/json') {
        res.status(400).json({message: 'Server only accepts POST requests with application/json content'})
        return
    }
    const requestBody = req.body
    const description_values = requestBody.description_values
    const description = requestBody.description?.toString()
    if (!description) {
        res.status(400).json({message: "description not specified (required)"})
        return
    }
    const pool = new Pool()
    const result = await pool.query("SELECT value FROM filing_history_descriptions WHERE key=$1 LIMIT 1", [description]).catch(console.error)
    await pool.end()
    if (!result || result.rowCount !== 1) {
        res.status(404).end()
        return // can't find description in database (rare)
    }
    let formattedDescription = result.rows[0]['value'].replace(/{([a-z_]+)}/g, (s) => description_values ? description_values[s.slice(1, s.length - 1)] || '' : '')
    // console.log('FormattedDescription:',formattedDescription)
    res.status(200).json({formattedDescription})
}