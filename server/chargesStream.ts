import * as request from "request";
import {ChargesEvent} from "../eventTypes";
// import * as faker from 'faker'
const faker = require('faker')

export const StreamCharges = (io, mode: 'test' | 'live') => {
    if (mode == "test") {
        // setInterval(()=>io.emit("heartbeat", {}), Math.random()*20000)
        // setInterval(()=>console.log("Charge heartbeat"), Math.random()*20000)
        //faker:
        setTimeout(() => {
            io.emit('event', {
                    "data": {
                        "address": {
                            "address_line_1": faker.address.streetAddress(),
                            "address_line_2": faker.address.secondaryAddress(),
                            "care_of": "string",
                            "country": faker.address.country(),
                            "locality": faker.address.county(),
                            "po_box": faker.address.zipCode(),
                            "postal_code": faker.address.zipCodeByState(),
                            "premises": faker.address.secondaryAddress(),
                            "region": faker.address.county()
                        },
                        "ceased": faker.random.boolean(),
                        "ceased_on": faker.date.past(),
                        "country_of_residence": faker.address.country(),
                        "date_of_birth": {
                            "day": 5,
                            "month": 5,
                            "year": 5
                        },
                        "description": faker.commerce.productDescription(),
                        "etag": "string",
                        "identification": {
                            "country_registered": faker.address.country(),
                            "legal_authority": "string",
                            "legal_form": "string",
                            "place_registered": "string",
                            "registration_number": faker.random.uuid()
                        },
                        "kind": "string",
                        "links": {
                            "self": "string",
                            "statement": "string"
                        },
                        "name": faker.name.findName(),
                        "name_elements": {
                            "forename": faker.name.firstName(),
                            "other_forenames": faker.name.firstName(),
                            "surname": faker.name.lastName(),
                            "title": faker.name.prefix()
                        },
                        "nationality": "string",
                        "natures_of_control": [
                            faker.random.arrayElements(["ownership-of-shares-50-to-75-percent", "voting-rights-50-to-75-percent", "right-to-appoint-and-remove-directors"])
                        ],
                        "notified_on": faker.date.past()
                    },
                    "event": {
                        "fields_changed": [
                            "string"
                        ],
                        "published_at": faker.date.recent(),
                        "timepoint": faker.random.number(),
                        "type": faker.random.arrayElement(['changed', 'deleted'])
                    },
                    "resource_id": faker.random.uuid(),
                    "resource_kind": "charges",
                    "resource_uri": "/company/" + faker.random.number() + "/charges"
                }
            )
            StreamCharges(io, 'test')
        }, Math.random() * 20000)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/charges')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                console.log("Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
                        console.log("Listening to updates on charges stream")
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
                            let jsonObject: ChargesEvent.ChargesEvent = JSON.parse(jsonText)
                            io.emit('event', jsonObject)
                            console.log("CHARGES EVENT!!")
                            console.log(JSON.stringify(jsonObject))
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
