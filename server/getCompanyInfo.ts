import {Pool} from "pg";
import {Request, Response} from "express";
import {MongoClient} from 'mongodb'
import * as logger from 'node-color-log'

export const getCompanyInfo = async (req: Request, res: Response) => {
    const companyNumber = req.query?.company_number?.toString() || req.body?.company_number?.toString()
    if (!companyNumber) res.status(400).json({message: "Company number not specified"})
    else {
        console.time(`getCompanyInfo('${companyNumber}')`)
        const mongo = new MongoClient('mongodb://mongo-cache:27017',
            {auth: {user: process.env.MONGO_INITDB_ROOT_USERNAME, password: process.env.MONGO_INITDB_ROOT_PASSWORD}})
        await mongo.connect()
        const companiesCollection = mongo.db('companies').collection('company_info')
        const mongoCompany = await companiesCollection.findOne({'_id': companyNumber})
        if (mongoCompany) {
            logger.color('green').log('Mongo Cache HIT for company number:', companyNumber)
            res.status(200).json(mongoCompany)
            console.timeEnd(`getCompanyInfo('${companyNumber}')`)
            await mongo.close()
            return
        } else {
            logger.color('red').log('Mongo Cache MISS for company number:', companyNumber)
        }
        const sqlStartTime = Date.now()
        const pool = new Pool()
        await pool.query(`
            SELECT *
            FROM companies c
            WHERE c.number = $1
        `, [companyNumber])
            .then(async ({rows, rowCount}) => {
                await pool.end()
                console.info(`SELECT company info WHERE number = ${companyNumber} in ${Date.now() - sqlStartTime}ms`)
                if (rowCount === 1) {
                    const company = rows[0]
                    await mongo.db('companies')
                        .collection('company_info')
                        .insertOne(company)
                        .catch(e => {
                            console.error('Could not save to mongo:', e)
                        })
                    await mongo.close()

                    res.status(200).json({_id: company.number, ...company})
                    console.timeEnd(`getCompanyInfo('${companyNumber}')`)
                } else {
                    console.error(rowCount + " companies found for", companyNumber)
                    res.status(404).json({message: rowCount + " companies found"})
                    console.timeEnd(`getCompanyInfo('${companyNumber}')`)
                }
            }).catch(e => {
                console.error('Could not select company info from database:', e.message)
                res.status(404).json({message: "Company not found"})
                console.timeEnd(`getCompanyInfo('${companyNumber}')`)
            })
    }
}
