import * as request from "request";
import {CompanyProfileEvent} from "../eventTypes";
import * as faker from 'faker'
// //Variables for status update:
// let latestTimepoint = ''
// let numberOfPackets = 0
// let numberOfHeartbeats = 0
// let numberOfEvents = 0
// let numberOfNewCompanies = 0
// let startTime = Date.now()
// let streamPaused = false
export const StreamCompanies = (io, mode: 'test' | 'live') => {
    if (mode == "test") {
        // setTimeout(()=>io.emit("heartbeat", {}), Math.random()*10000)
        //todo: fakerjs
        setTimeout(() => {
            const companyNumber = faker.random.number({
                min: 999999,
                max: 13999999
            }).toString().padStart(8, '0')
            io.emit('event', {
                "data": {
                    "accounts": {
                        "accounting_reference_date": {
                            "day": "integer",
                            "month": "integer"
                        },
                        "last_accounts": {
                            "made_up_to": "date",
                            "type": {}
                        },
                        "next_due": "date",
                        "next_made_up_to": "date",
                        "overdue": "boolean"
                    },
                    "annual_return": {
                        "last_made_up_to": "date",
                        "next_due": "date",
                        "next_made_up_to": "date",
                        "overdue": "boolean"
                    },
                    "branch_company_details": {
                        "business_activity": "string",
                        "parent_company_name": "string",
                        "parent_company_number": "string"
                    },
                    "can_file": "boolean",
                    "company_name": faker.company.companyName(),
                    "company_number": companyNumber,
                    "company_status": "string",
                    "company_status_detail": "string",
                    "confirmation_statement": {
                        "last_made_up_to": "date",
                        "next_due": "date",
                        "next_made_up_to": "date",
                        "overdue": "boolean"
                    },
                    "date_of_cessation": "date",
                    "date_of_creation": "date",
                    "etag": "string",
                    "foreign_company_details": {
                        "accounting_requirement": {
                            "foreign_account_type": "string",
                            "terms_of_account_publication": "string"
                        },
                        "accounts": {
                            "account_period_from:": {
                                "day": "integer",
                                "month": "integer"
                            },
                            "account_period_to": {
                                "day": "integer",
                                "month": "integer"
                            },
                            "must_file_within": {
                                "months": "integer"
                            }
                        },
                        "business_activity": "string",
                        "company_type": "string",
                        "governed_by": "string",
                        "is_a_credit_finance_institution": "boolean",
                        "originating_registry": {
                            "country": "string",
                            "name": "string"
                        },
                        "registration_number": "string"
                    },
                    "has_been_liquidated": "boolean",
                    "has_charges": "boolean",
                    "has_insolvency_history": "boolean",
                    "is_community_interest_company": "boolean",
                    "jurisdiction": "string",
                    "last_full_members_list_date": "date",
                    "links": {
                        "persons_with_significant_control": "string",
                        "persons_with_significant_control_statements": "string",
                        "registers": "string",
                        "self": "string"
                    },
                    "previous_company_names": [
                        {
                            "ceased_on": "date",
                            "effective_from": "date",
                            "name": "string"
                        }
                    ],
                    "registered_office_address": {
                        "address_line_1": "string",
                        "address_line_2": "string",
                        "care_of": "string",
                        "country": "string",
                        "locality": "string",
                        "po_box": "string",
                        "postal_code": "string",
                        "premises": "string",
                        "region": "string"
                    },
                    "registered_office_is_in_dispute": "boolean",
                    "sic_codes": [
                        "string"
                    ],
                    "type": "string",
                    "undeliverable_registered_office_address": "boolean"
                },
                "event": {
                    "fields_changed": [
                        "string"
                    ],
                    "published_at": faker.date.recent(),
                    "timepoint": faker.random.number(),
                    "type": faker.random.arrayElement(['changed', 'deleted'])
                },
                "resource_id": "string",
                "resource_kind": "company-profile",
                "resource_uri": "string"
            })
            StreamCompanies(io, 'test')
        }, Math.random() * 1800)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/companies')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                console.log("Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
                        console.log("Listening to updates on companies stream")
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
                            let jsonObject: CompanyProfileEvent.CompanyProfileEvent = JSON.parse(jsonText)
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
