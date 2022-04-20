import pg from "pg";

const { Pool } = pg;

import { Request, Response } from "express";
import * as logger from "node-color-log";
import { getMongoClient } from "../database/getMongoClient";

export const getCompanyInfoApi = async (req: Request, res: Response) => {
  // tries to get companyNumber from request JSON body and URL query parameters
  const companyNumber =
    req.query?.company_number?.toString() ||
    req.body?.company_number?.toString();
  if (!companyNumber)
    res.status(400).json({ message: "Company number not specified" })
  else {
    // console.time(`getCompanyInfo('${companyNumber}')`)
    const company = await getCompanyInfo(companyNumber)
    if (company) {
      res.status(200).json({ _id: company.number, ...company })
    } else {
      console.timeLog(
        `getCompanyInfo('${companyNumber}')`,
        " Company not found"
      )
      res.status(404).json({ message: "Company not found" })
    }
    // console.timeEnd(`getCompanyInfo('${companyNumber}')`)
  }
}

// get company: first try mongo cache, and on miss try postgres. saves not_found
export const getCompanyInfo = async (companyNumber: string) => {
  const mongoCompany = await getCompanyFromMongo(companyNumber)
  if (mongoCompany) {
    return mongoCompany
  } else {
    const postgresCompany = await getCompanyFromPostgres(companyNumber)
    if (postgresCompany) {
      await saveCompanyInMongo(postgresCompany)
      return postgresCompany
    } else {
      await saveCompanyInTodoList(companyNumber) // keep track of not found companies
      return null
    }
  }
}

// tries to fetch a company from the postgres database
const getCompanyFromPostgres = async (companyNumber: string) => {
  try {
    const pool = new Pool()
    const sqlStartTime = Date.now()
    const { rows, rowCount } = await pool.query(
      `
            SELECT c.*, dp.lat, dp.long
            FROM companies c
                     JOIN detailed_postcodes dp on c.postcode = dp.postcode
            WHERE c.number = $1
        `,
      [companyNumber]
    )
    await pool.end()
    // console.info(
    //   `SELECT company info WHERE number = ${companyNumber} in ${
    //     Date.now() - sqlStartTime
    //   }ms`
    // )
    if (rowCount === 1) return rows[0]
    else return null
  } catch (e) {
    console.error("Error fetching company from postgres:", e.message)
    return null
  }
}

// tries to fetch a company from Mongo database. Returns null on failure
const getCompanyFromMongo = async (companyNumber: string) => {
  if (Number(process.env.MONGO_CACHING) !== 1) return null
  const mongo = await getMongoClient()
  const mongoCompany = await mongo
    .db("companies")
    .collection("company_info")
    .findOne({ _id: companyNumber })
  await mongo.close()
  // logger
  //   .color(mongoCompany ? "green" : "red")
  //   .log(
  //     `Mongo Cache ${mongoCompany ? "HIT" : "MISS"} for company number:`,
  //     companyNumber
  //   )
  return mongoCompany
}
// tries to cache a company in the mongo database
const saveCompanyInMongo = async (company) => {
  if (Number(process.env.MONGO_CACHING) !== 1) return
  const mongo = await getMongoClient()
  await mongo
    .db("companies")
    .collection("company_info")
    .insertOne({ _id: company.number, ...company })
    .catch((e) => {
      if (e.code != 11000) console.error("Could not save to mongo:", e)
    })
  await mongo.close()
}

const saveCompanyInTodoList = async (companyNumber) => {
  if (Number(process.env.MONGO_CACHING) !== 1) return
  const mongo = await getMongoClient()
  await mongo
    .db("not_found")
    .collection("companies")
    .insertOne({
      _id: companyNumber,
      timestampAdded: Date.now(),
      companyNumber,
    })
    .then(() =>
      console.log(
        `Saved company ${companyNumber} in not_found.companies todo-list`
      )
    )
    .catch((e) => {
      if (e.code != 11000)
        console.error("Failed to save not_found company in todo list:", e)
    })
  await mongo.close()
}
