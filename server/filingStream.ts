import * as request from "request";
import {FilingEvent} from '../eventTypes'
import {Pool} from "pg";
import {FilingEmit} from "../emitTypes";

const {promisify} = require('util')
let mostRecentWaitTime = 0
const wait = promisify((s, c) => {
    mostRecentWaitTime = s
    if (!isFinite(s)) s = 300
    if (s > 5000) s = 5000
    setTimeout(() => c(null, 'done waiting'), s)
})
let qtyOfNotifications = 0
let averageProcessingTime = 0
let startTime = Date.now()
let reportStatsInterval
let resetStatsInterval
let last60NotificationTimes = []
let last60ProcessingTimes = []
let last60Backlog = []
export const StreamFilings = (io, mode: 'test' | 'live', dbPool: Pool) => {
    if (mode == "test") {
        setTimeout(async () => {
            const client = await dbPool.connect()
            // test the database connection
            const {
                rows: dbtest,
                rowCount
            } = await client.query("SELECT value FROM filing_history_descriptions WHERE key=$1", ['liquidation-voluntary-appeal'])
            if (rowCount === 1)
                console.log("Database test: ", dbtest[0]['value'])
            await client.release()
            io.emit('event', sampleFilingEvents[Math.floor(Math.random() * sampleFilingEvents.length)])
            StreamFilings(io, 'test', dbPool)
        }, Math.random() * 2000)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/filings')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                startTime = Date.now()
                setTimeout(() => {
                    console.log("Killing the filing stream after 24 hours")
                    reqStream.end()
                }, 1000 * 60 * 60 * 24) // end after 24 hours
                console.log("filing Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
                        console.time("Listening on filing stream")
                        //TRYING TO NOT RESET STATS ANYMORE
                        // resetStatsInterval = setInterval(() => {
                        //     console.timeLog("Listening on filing stream", `Reset filing stats after ${qtyOfNotifications} notifications`)
                        //     // reset stats every hour
                        //     last60NotificationTimes = []
                        //     last60ProcessingTimes = []
                        //     last60Backlog = []
                        //     qtyOfNotifications = 0
                        //     averageProcessingTime = 0
                        //     startTime = Date.now()
                        // }, 2001111)// staggered reseting to prevent them all reseting at the same time for an unfortunate user experience
                        reportStatsInterval = setInterval(() => {
                            // console.log(`Filing - Average processing time: ${Math.round(averageProcessingTime)}ms, new notification every ${Math.round((Date.now() - startTime) / qtyOfNotifications)}ms`)
                            const last60TotalTime = last60NotificationTimes[0] - last60NotificationTimes[last60NotificationTimes.length - 1]
                            const last60ProcessingTime = last60ProcessingTimes.slice(0, 5).reduce((previousValue, currentValue) => previousValue + currentValue, 0)
                            const recentProcessingTimePerNotification = last60ProcessingTime / last60ProcessingTimes.slice(0, 5).length
                            const averageTimePerNewNotification = (last60TotalTime / (last60NotificationTimes.length + 1))
                            const averageBacklog = last60Backlog.reduce((previousValue, currentValue) => previousValue + currentValue, 0) / last60Backlog.length / 1000
                            // console.log("Last 60 average proc time", Math.round(last60ProcessingTimes.reduce((previousValue, currentValue) => previousValue+currentValue)/last60ProcessingTimes.length) / 1000, 'seconds')
                            // console.log("Last 60 average notification time", Math.round(averageTimePerNewNotification) / 1000, 'seconds')
                            // process.stdout.clearLine(null)
                            // process.stdout.cursorTo(0)
                            // process.stdout.write(`Backlog: ${Math.round(averageBacklog)}s | proc/note ${Math.round(recentProcessingTimePerNotification / averageTimePerNewNotification * 100)}% | Processing time: ${Math.round(recentProcessingTimePerNotification)}ms | Notification freq: ${Math.round(averageTimePerNewNotification)}ms/new notif. Array sizes: ${last60ProcessingTimes.length}, ${last60NotificationTimes.length}, ${last60Backlog.length} | most recent wait time: ${Math.round(mostRecentWaitTime)}ms`)
                            console.log("FILING: Average backlog on filing: ", Math.round(averageBacklog), 'seconds')
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
                        last60NotificationTimes.unshift(Date.now())
                        if (qtyOfNotifications > 100)
                            last60NotificationTimes.pop()
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

                            const {
                                rows: descriptions,
                                rowCount
                            } = await client.query("SELECT value FROM filing_history_descriptions WHERE key=$1 LIMIT 1", [jsonObject.data.description])
                            // console.timeLog('Process filing history',{"Database response": descriptions})
                            if (rowCount === 1) {
                                const description: string = descriptions[0]['value']
                                let formattedDescription = description.replace(/{([a-z_]+)}/g, (s) => jsonObject.data.description_values ? jsonObject.data.description_values[s.slice(1, s.length - 1)] || '' : '')
                                formattedDescription = formattedDescription.replace(/^\*\*/, '<b>')
                                formattedDescription = formattedDescription.replace(/\*\*/, '</b>')
                                // console.log(formattedDescription)
                                // if(companysFound === 1)
                                const eventToEmit: FilingEmit = {
                                    source: 'filing-history',
                                    title: formattedDescription.match(/<b>(.+)<\/b>/) ? formattedDescription.match(/<b>(.+)<\/b>/)[1] : jsonObject.data.category,
                                    description: formattedDescription,
                                    published: new Date(jsonObject.event.published_at),
                                    companyNumber: companyNumber,
                                    resource_kind: 'filing-history',
                                    companyProfile: companysFound === 1 ? companyProfile[0] : undefined
                                }
                                last60Backlog.unshift(Date.now() - eventToEmit.published.valueOf())

                                //work out rolling average of receival time using notifications and processing timing arrays
                                if (qtyOfNotifications > 5) {
                                    const last60TotalTime = last60NotificationTimes[0] - last60NotificationTimes[last60NotificationTimes.length - 1]
                                    const last60ProcessingTime = last60ProcessingTimes.slice(0, 5).reduce((previousValue, currentValue) => previousValue + currentValue, 0)
                                    const recentProcessingTimePerNotification = last60ProcessingTime / last60ProcessingTimes.slice(0, 5).length
                                    const averageTimePerNewNotification = (last60TotalTime / (last60NotificationTimes.length + 1))
                                    const averageBacklog = last60Backlog.reduce((previousValue, currentValue) => previousValue + currentValue, 0) / last60Backlog.length / 1000
                                    // console.log(last60TotalTime,last60ProcessingTime,recentProcessingTimePerNotification,averageTimePerNewNotification,averageBacklog)
                                    last60Backlog.pop()
                                    // if average processing time is less than 70% of the frequency of new notifications
                                    if ((recentProcessingTimePerNotification / averageTimePerNewNotification * 100) < 70 && averageBacklog < 60 * 10)
                                        await wait(averageTimePerNewNotification - (Date.now() - singleStartTime))
                                    else if ((recentProcessingTimePerNotification / averageTimePerNewNotification * 100) < 100 && averageBacklog < 60 * 10) // kill switch to never exceed 100%
                                        await wait((averageTimePerNewNotification - (Date.now() - singleStartTime)) * 0.5)
                                    // else
                                    //     console.log('\nPercentage: ', Math.round(recentProcessingTimePerNotification / averageTimePerNewNotification * 100), '% | Backlog:', Math.round(averageBacklog), 'seconds')

                                }
                                io.emit('event', eventToEmit)
                            } else {
                                if (jsonObject.data.description && jsonObject.data.description !== 'legacy') // some are undefined and legacy
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
                        last60ProcessingTimes.unshift(Date.now() - singleStartTime)
                        if (qtyOfNotifications > 50)
                            last60ProcessingTimes.pop()
                    }
                    reqStream.resume()
                } else {
                    io.emit('heartbeat', {})
                }
            })
            .on('end', async () => {
                try {
                    clearInterval(reportStatsInterval)
                    clearInterval(resetStatsInterval)
                } catch (e) {

                }

                console.timeEnd("Listening on filing stream")
                console.error("Filing stream ended")
            })
    }
}

//test types with a real record:
const sampleFilingEvents: FilingEvent.FilingEvent[] = [
    {
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
