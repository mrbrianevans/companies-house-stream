import * as request from "request";
import {FilingEvent} from '../eventTypes'

const faker = require('faker')

export const StreamFilings = (io, mode: 'test' | 'live') => {
    if (mode == "test") {
        // setInterval(()=>io.emit("heartbeat", {}), Math.random()*20000)
        // setInterval(()=>console.log("Filing heartbeat"), Math.random()*20000)
        //faker:
        setTimeout(() => {
            const companyNumber = faker.random.number({
                min: 999999,
                max: 13999999
            }).toString().padStart(8, '0')
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
            StreamFilings(io, 'test')
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
                    while (dataBuffer.includes('\n')) {
                        let newLinePosition = dataBuffer.search('\n')
                        let jsonText = dataBuffer.slice(0, newLinePosition)
                        dataBuffer = dataBuffer.slice(newLinePosition + 1)
                        try {
                            let jsonObject: FilingEvent.FilingEvent = JSON.parse(jsonText)
                            io.emit('event', jsonObject)
                        } catch (e) {
                            console.error(`\x1b[31mCOULD NOT PARSE: \x1b[0m*${jsonText}*`)
                        }
                    }
                    reqStream.resume()
                } else {
                    io.emit('heartbeat', {})
                }
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
