import * as request from "request";
import {FilingEvent} from '../eventTypes'
import {Pool} from "pg";
import {FilingEmit} from "../emitTypes";

const requestPromise = require("request-promise");
const faker = require('faker')
const {promisify} = require('util')
const wait = promisify((s, c) => {
    // console.log("Waiting for", s, "ms on filing")
    if (!isFinite(s)) s = 300
    if (s > 5000) s = 1000
    setTimeout(() => c(null, 'done waiting'), s)
})
let qtyOfNotifications = 0
let averageProcessingTime = 0
let startTime = Date.now()

export const StreamFilings = (io, mode: 'test' | 'live', dbPool: Pool) => {
    if (mode == "test") {
        // setInterval(()=>io.emit("heartbeat", {}), Math.random()*20000)
        // setInterval(()=>console.log("Filing heartbeat"), Math.random()*20000)
        //faker:
        setTimeout(async () => {
            const companyNumber = faker.random.number({
                min: 999999,
                max: 13999999
            }).toString().padStart(8, '0')
            const client = await dbPool.connect()
            // test the database connection
            const {
                rows: dbtest,
                rowCount
            } = await client.query("SELECT value FROM filing_history_descriptions WHERE key=$1", ['liquidation-voluntary-appeal'])
            if (rowCount === 1)
                console.log("Database test: ", dbtest[0]['value'])
            await client.release()
            io.emit('event', {
                "resource_kind": "filing-history",
                "resource_uri": `/company/${companyNumber}/filing-history/${faker.random.uuid()}`,
                "resource_id": faker.random.uuid(),
                "data": {
                    "barcode": "X9WQX0NE",
                    "category": faker.random.arrayElement([
                        'accounts',
                        'address',
                        'annual-return',
                        'capital',
                        'change-of-name',
                        'incorporation',
                        'liquidation',
                        'miscellaneous',
                        'mortgage',
                        'officers',
                        'resolution'
                    ]),
                    "date": faker.date.recent(),
                    "description": faker.random.arrayElement([
                        'full',
                        'small',
                        'medium',
                        'group',
                        'dormant',
                        'interim',
                        'initial',
                        'total-exemption-full',
                        'total-exemption-small',
                        'partial-exemption',
                        'audit-exemption-subsidiary',
                        'filing-exemption-subsidiary',
                        'micro-entity', 'null'
                    ]),
                    "description_values": {
                        "made_up_date": faker.date.past()
                    },
                    "links": {
                        "self": `/company/${companyNumber}/filing-history/${faker.random.uuid()}`
                    },
                    "transaction_id": faker.vehicle.vin(),
                    "type": "AA"
                },
                "event": {
                    "timepoint": faker.random.number(),
                    "published_at": faker.date.recent(),
                    "type": "changed"
                }
            })
            StreamFilings(io, 'test', dbPool)
        }, Math.random() * 2000)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/filings')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                startTime = Date.now()
                console.log("Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
                        console.time("Listening on filing stream")
                        setInterval(() => {
                            console.timeLog("Listening on filing stream", `Reset filing stats after ${qtyOfNotifications} notifications`)
                            // reset stats every hour
                            qtyOfNotifications = 0
                            averageProcessingTime = 0
                            startTime = Date.now()
                        }, 5000000)
                        setInterval(() => {
                            console.log(`Filing - Average processing time: ${Math.round(averageProcessingTime)}ms, new notification every ${Math.round((Date.now() - startTime) / qtyOfNotifications)}ms`)
                        }, 1000000)
                        console.log("Listening to updates on filing stream")
                        break;
                    case 416:
                        console.log("Timepoint out of date")
                        break;
                    case 429:
                        console.log("RATE LIMITED, exiting now")
                        process.exit()
                        break;
                    default:
                        process.exit()
                }
            })
            .on('error', (e: Error) => console.error('Ferror', e))
            .on('data', async (d: any) => {
                if (d.toString().length > 1) {
                    reqStream.pause()

                    dataBuffer += d.toString('utf8')
                    dataBuffer = dataBuffer.replace('}}{', '}}\n{')
                    while (dataBuffer.includes('\n')) {
                        let singleStartTime = Date.now()
                        // console.time('Process filing history')
                        let newLinePosition = dataBuffer.search('\n')
                        let jsonText = dataBuffer.slice(0, newLinePosition)
                        dataBuffer = dataBuffer.slice(newLinePosition + 1)
                        if (jsonText.length === 0) continue;
                        const client = await dbPool.connect()
                        try {
                            let jsonObject: FilingEvent.FilingEvent = JSON.parse(jsonText)
                            const companyNumber = jsonObject.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/filing-history/)[1]
                            // query enumeration map in database to figure out what the company has filed
                            // slow down the stream and send more meaningful information in teh notification
                            let {
                                rows: companyProfile,
                                rowCount: companysFound
                            } = await client.query("SELECT * FROM companies WHERE number=$1 LIMIT 1", [companyNumber])

                            // fetch from API to slow down a bit
                            // const apiProfile = await requestPromise.get('https://companies-house-frontend-api-rmfuc.ondigitalocean.app/api/company/' + companyNumber)
                            //     .catch(e=>console.log('e'))
                            // This stops the wait from limiting the rate of receival too much
                            // console.log("Processing time as a % of time per new notification: ", Math.round(averageProcessingTime/((Date.now() - startTime) / qtyOfNotifications)*100))
                            if (averageProcessingTime / ((Date.now() - startTime) / qtyOfNotifications) * 100 < 80)
                                await wait(((Date.now() - startTime) / qtyOfNotifications) - (Date.now() - singleStartTime))
                            else if (averageProcessingTime / ((Date.now() - startTime) / qtyOfNotifications) * 100 < 100) // kill switch to never exceed 100%
                                await wait((((Date.now() - startTime) / qtyOfNotifications) - (Date.now() - singleStartTime)) * 0.5)
                            const {
                                rows: descriptions,
                                rowCount
                            } = await client.query("SELECT value FROM filing_history_descriptions WHERE key=$1 LIMIT 1", [jsonObject.data.description])
                            // console.timeLog('Process filing history',{"Database response": descriptions})
                            if (rowCount === 1) {
                                const description: string = descriptions[0]['value']
                                let formattedDescription = description.replace(/{([a-z_]+)}/g, (s) => jsonObject.data.description_values[s.slice(1, s.length - 1)])
                                formattedDescription = formattedDescription.replace(/^\*\*/, '<b>')
                                formattedDescription = formattedDescription.replace(/\*\*/, '</b>')
                                // console.log(formattedDescription)
                                // if(companysFound === 1)
                                const eventToEmit: FilingEmit = {
                                    source: 'filing-history',
                                    title: formattedDescription.match(/<b>(.+)<\/b>/)[1],
                                    description: formattedDescription,
                                    published: new Date(jsonObject.event.published_at),
                                    companyNumber: companyNumber,
                                    resource_kind: 'filing-history',
                                    companyProfile: companysFound === 1 ? companyProfile[0] : undefined
                                }
                                io.emit('event', eventToEmit)
                            } else {
                                if (jsonObject.data.description) // some are undefined
                                    console.log("\x1b[31mDatabase could not find description\x1b[0m for", jsonObject.data.description)
                            }

                        } catch (e) {
                            // error handling
                            if (e instanceof SyntaxError)
                                console.error(`\x1b[31mCOULD NOT PARSE filing: \x1b[0m*${jsonText}*`)
                            else
                                console.error('\x1b[31m', e, '\x1b[0m')
                        } finally {
                            await client.release() // release the client when finished, regardless of errors
                            // console.timeEnd('Process filing history')
                        }

                        let totalTimeSoFar = qtyOfNotifications++ * averageProcessingTime + (Date.now() - singleStartTime)
                        averageProcessingTime = totalTimeSoFar / qtyOfNotifications

                    }
                    reqStream.resume()
                } else {
                    io.emit('heartbeat', {})
                }
            })
            .on('end', async () => {
                console.timeEnd("Listening on filing stream")
                await dbPool.end()
                console.error("Filing stream ended")
            })
    }
}

//test types with a real record:
const e: FilingEvent.FilingEvent[] = [{
    "resource_kind": "filing-history",
    "resource_uri": "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4",
    "resource_id": "MzI4OTQzODc5MGFkaXF6a2N4",
    "data": {
        "barcode": "X9WQX0NE",
        "category": "accounts",
        "date": "2021-01-22",
        "description": "accounts-with-accounts-type-micro-entity",
        "description_values": {
            "made_up_date": "2020-03-31"
        },
        "links": {
            "self": "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4"
        },
        "transaction_id": "MzI4OTQzODc5MGFkaXF6a2N4",
        "type": "AA"
    },
    "event": {
        "timepoint": 48990574,
        "published_at": "2021-01-22T18:28:02",
        "type": "changed"
    }
},
    {
        "resource_kind": "filing-history",
        "resource_uri": "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4",
        "resource_id": "MzI2NTIzNzU0N2FkaXF6a2N4",
        "data": {
            "annotations": [{
                "annotation": "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
                "category": "annotation",
                "date": "2021-01-25",
                "description": "annotation",
                "description_values": {"description": "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21"},
                "type": "ANNOTATION"
            }],
            "barcode": "X95HGATK",
            "category": "confirmation-statement",
            "date": "2020-05-20",
            "description": "confirmation-statement",
            "description_values": {"original_description": "20/05/20 Statement of Capital gbp 126"},
            "links": {
                "document_metadata": "https://frontend-doc-api.companieshouse.gov.uk/document/TsRu1rGfoPfqgDJB2RvUReq1XPkdrjvr302RHkUW_ww",
                "self": "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4"
            },
            "pages": 5,
            "paper_filed": true,
            "transaction_id": "MzI2NTIzNzU0N2FkaXF6a2N4",
            "type": "CS01"
        },
        "event": {"timepoint": 49098961, "published_at": "2021-01-25T13:32:01", "type": "changed"}
    },
    {
        "resource_kind": "filing-history",
        "resource_uri": "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4",
        "resource_id": "MzI4MDM0NDI4NGFkaXF6a2N4",
        "data": {
            "annotations": [{
                "annotation": "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
                "category": "annotation",
                "date": "2021-01-25",
                "description": "annotation",
                "description_values": {"description": "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21"},
                "type": "ANNOTATION"
            }],
            "barcode": "X9FIEB6B",
            "category": "confirmation-statement",
            "date": "2020-10-12",
            "description": "confirmation-statement",
            "description_values": {"original_description": "21/07/20 Statement of Capital eur 38000001"},
            "links": {
                "document_metadata": "https://frontend-doc-api.companieshouse.gov.uk/document/2IPexI9Xo_VfyzWXITSO4cQ7LvDWwN4U24rNeUlCBHE",
                "self": "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4"
            },
            "pages": 4,
            "paper_filed": true,
            "transaction_id": "MzI4MDM0NDI4NGFkaXF6a2N4",
            "type": "CS01"
        },
        "event": {"timepoint": 49096881, "published_at": "2021-01-25T13:16:02", "type": "changed"}
    },
    {
        "resource_kind": "filing-history",
        "resource_uri": "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
        "resource_id": "MzI4MzUzMjgyMGFkaXF6a2N4",
        "data": {
            "annotations": [{
                "annotation": "Clarification A second filed CS01  (Statement of capital change and Shareholder information change) was registered on 25/01/2021.",
                "category": "annotation",
                "date": "2021-01-25",
                "description": "annotation",
                "description_values": {"description": "Clarification a second filed CS01 (Statement of capital change and Shareholder information change) was registered on 25/01/2021."},
                "type": "ANNOTATION"
            }],
            "barcode": "X9HYDHPL",
            "category": "confirmation-statement",
            "date": "2020-11-16",
            "description": "confirmation-statement",
            "description_values": {"original_description": "14/11/20 Statement of Capital gbp 300.00"},
            "links": {
                "document_metadata": "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
                "self": "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4"
            },
            "pages": 5,
            "paper_filed": true,
            "transaction_id": "MzI4MzUzMjgyMGFkaXF6a2N4",
            "type": "CS01"
        },
        "event": {"timepoint": 49095333, "published_at": "2021-01-25T13:04:04", "type": "changed"}
    },
    {
        "resource_kind": "filing-history",
        "resource_uri": "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
        "resource_id": "MzI4MzUzMjgyMGFkaXF6a2N4",
        "data": {
            "barcode": "X9HYDHPL",
            "category": "confirmation-statement",
            "date": "2020-11-16",
            "description": "confirmation-statement",
            "description_values": {"original_description": "14/11/20 Statement of Capital gbp 300.00"},
            "links": {
                "document_metadata": "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
                "self": "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4"
            },
            "pages": 5,
            "transaction_id": "MzI4MzUzMjgyMGFkaXF6a2N4",
            "type": "CS01"
        },
        "event": {"timepoint": 49094846, "published_at": "2021-01-25T13:01:04", "type": "changed"}
    }
]
