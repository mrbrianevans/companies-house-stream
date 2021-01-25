import * as request from "request";
import {FilingEvent} from '../eventTypes'
import {Pool} from "pg";
import {FilingEmit} from "../emitTypes";

const faker = require('faker')

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
        }, Math.random() * 8000)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/filings')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                console.log("Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
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
            .on('error', (e: any) => console.error('error', e))
            .on('data', async (d: any) => {
                if (d.toString().length > 1) {
                    reqStream.pause()

                    dataBuffer += d.toString('utf8')
                    dataBuffer = dataBuffer.replace('}}{', '}}\n{')
                    while (dataBuffer.includes('\n')) {
                        // console.time('Process filing history')
                        let newLinePosition = dataBuffer.search('\n')
                        let jsonText = dataBuffer.slice(0, newLinePosition)
                        dataBuffer = dataBuffer.slice(newLinePosition + 1)
                        if (jsonText.length === 0) continue;
                        try {
                            let jsonObject: FilingEvent.FilingEvent = JSON.parse(jsonText)
                            const companyNumber = jsonObject.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/filing-history/)[1]
                            // query enumeration map in database to figure out what the company has filed
                            // slow down the stream and send more meaningful information in teh notification
                            const client = await dbPool.connect()
                            const {
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
                                console.log("\x1b[32mDatabase could not find description\x1b[0m for", jsonObject.data.description)
                            }

                            await client.release()
                        } catch (e) {
                            // console.error(e)
                            console.error(`\x1b[31mCOULD NOT PARSE filing: \x1b[0m*${jsonText}*`)
                        } finally {
                            // console.timeEnd('Process filing history')
                        }
                    }
                    reqStream.resume()
                } else {
                    io.emit('heartbeat', {})
                }
            })
            .on('end', () => {
                console.error("Filing stream ended")
            })
    }
}

//test types with a real record:
const e: FilingEvent.FilingEvent = {
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
}
