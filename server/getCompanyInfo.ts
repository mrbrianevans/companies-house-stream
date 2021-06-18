import {Pool} from "pg";
import {Request, Response} from "express";

export const getCompanyInfo = (req: Request, res: Response) => {
    const pool = new Pool()
    const companyNumber = req.query?.company_number?.toString() || req.body?.company_number?.toString()
    if (!companyNumber) res.status(400).json({message: "Company number not specified"})
    else {
        const sqlStartTime = Date.now()
        pool.query(`
            SELECT *
            FROM companies
            WHERE number = $1
        `, [companyNumber])
            .then(({rows, rowCount}) => {
                // console.info(`SELECT company info WHERE number = ${companyNumber} in ${Date.now() - sqlStartTime}ms`)
                if (rowCount === 1) {
                    res.status(200).json(rows[0])
                } else {
                    console.error(rowCount + " companies found for", companyNumber)
                    res.status(404).json({message: rowCount + " companies found"})
                }
            }).catch(e => {
            console.error('Could not select company info from database:', e.message)
            res.status(404).json({message: "Company not found"})
        })
    }
}
