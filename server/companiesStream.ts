import * as request from "request";
import {CompanyProfileEvent} from "../eventTypes";
import * as faker from 'faker'
import {Pool} from "pg";
// //Variables for status update:
// let latestTimepoint = ''
// let numberOfPackets = 0
// let numberOfHeartbeats = 0
// let numberOfEvents = 0
// let numberOfNewCompanies = 0
// let startTime = Date.now()
// let streamPaused = false
const {promisify} = require('util')
const wait = promisify((s, c) => {
    // console.log("Waiting for", s, "ms on company")
    if (!isFinite(s)) s = 300
    if (s > 5000) s = 5000
    setTimeout(() => c(null, 'done waiting'), s / 3) // divide by 3 to stop getting kicked off companies house server
})
let qtyOfNotifications = 0
let averageProcessingTime = 0
let startTime = Date.now()
export const StreamCompanies = (io, mode: 'test' | 'live', dbPool: Pool) => {
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
            StreamCompanies(io, 'test', dbPool)
        }, Math.random() * 2500)
    } else {
        let dataBuffer = ''
        const reqStream = request.get('https://stream.companieshouse.gov.uk/companies')
            .auth(process.env.APIUSER, '')
            .on('response', (r: any) => {
                console.log("company Headers received, status", r.statusCode)
                switch (r.statusCode) {
                    case 200:
                        console.time("Listening on company stream")
                        setInterval(() => {
                            console.timeLog("Listening on company stream", `Reset comp stats after ${qtyOfNotifications} notifications`)
                            // reset stats every hour
                            qtyOfNotifications = 0
                            averageProcessingTime = 0
                            startTime = Date.now()
                        }, 2501111) // staggered reseting to prevent them all reseting at the same time for an unfortunate user experience
                        setInterval(() => {
                            console.log(`Company - Average processing time: ${Math.round(averageProcessingTime)}ms, new notification every ${Math.round((Date.now() - startTime) / qtyOfNotifications)}ms`)
                        }, 1000000)
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
                        let singleStartTime = Date.now()
                        let newLinePosition = dataBuffer.search('\n')
                        let jsonText = dataBuffer.slice(0, newLinePosition)
                        dataBuffer = dataBuffer.slice(newLinePosition + 1)
                        if (jsonText.length === 0) continue;
                        try {
                            let jsonObject: CompanyProfileEvent.CompanyProfileEvent = JSON.parse(jsonText)
                            // query database for previous information held on company to detect what has changed
                            // This stops the wait from limiting the rate of receival too much
                            // console.log("Processing time as a % of time per new notification: ", Math.round(averageProcessingTime/((Date.now() - startTime) / qtyOfNotifications)*100))
                            if (qtyOfNotifications > 75 && averageProcessingTime / ((Date.now() - startTime) / qtyOfNotifications) * 100 < 60)
                                await wait(((Date.now() - startTime) / qtyOfNotifications) - (Date.now() - singleStartTime) - 100) // always minus 100 milliseconds
                            else if (qtyOfNotifications > 70 && averageProcessingTime / ((Date.now() - startTime) / qtyOfNotifications) * 100 < 100) // kill switch to never exceed 100%
                                await wait((((Date.now() - startTime) / qtyOfNotifications) - (Date.now() - singleStartTime)) * 0.5 - 100)

                            const companyFromStream = {
                                name: jsonObject.data.company_name,
                                number: jsonObject.data.company_number,
                                streetaddress: jsonObject.data.registered_office_address?.address_line_1 || '',
                                county: jsonObject.data.registered_office_address?.region || '',
                                country: jsonObject.data.registered_office_address?.country || '',
                                postcode: jsonObject.data.registered_office_address?.postal_code || '',
                                category: companyTypeConversion[jsonObject.data.type],
                                origin: jsonObject.data.foreign_company_details?.originating_registry.country || 'United Kingdom',
                                status: jsonObject.data.company_status,
                                date: new Date(jsonObject.data.date_of_creation)
                                // sicCodes: jsonObject.data.sic_codes,
                            }
                            const {
                                rows: companyFromDatabase,
                                rowCount: companiesFoundInDatabase
                            } = await dbPool.query('SELECT * FROM companies WHERE number=$1', [jsonObject.data.company_number])

                            if (companiesFoundInDatabase) {
                                // compare details to see what changed
                                const differences = []
                                for (const companyFromStreamKey in companyFromStream) {
                                    switch (companyFromStreamKey) {
                                        case 'date':
                                            break; // date of creation can't change once its happened
                                        case 'streetaddress': // special comparison for street addresses
                                            if (!String(companyFromStream[companyFromStreamKey]).toUpperCase().startsWith(String(companyFromDatabase[0][companyFromStreamKey]).toUpperCase()))
                                                differences.push({
                                                    label: companyFromStreamKey,
                                                    new: companyFromStream[companyFromStreamKey],
                                                    old: companyFromDatabase[0][companyFromStreamKey]
                                                })
                                            break;
                                        default:
                                            if (String(companyFromStream[companyFromStreamKey]).toUpperCase() !== String(companyFromDatabase[0][companyFromStreamKey]).toUpperCase())
                                                differences.push({
                                                    label: companyFromStreamKey,
                                                    new: companyFromStream[companyFromStreamKey],
                                                    old: companyFromDatabase[0][companyFromStreamKey]
                                                })
                                            break;
                                    }
                                }
                                if (differences.length > 0) {
                                    if (differences.findIndex(difference => difference.label === 'streetaddress') > -1 &&
                                        differences.findIndex(difference => difference.label === 'postcode') > -1) console.log("Address changed from ", companyFromDatabase[0].streetaddress, 'to', companyFromStream.streetaddress)
                                    // else console.log("Differences found in company", companyFromStream.number, differences)
                                }
                                // else console.log("No differences found between stream and database for company", companyFromStream.number)
                            } else {
                                // console.log("Potential new company? ", companyFromStream.number, companyFromStream.date)
                            }
                            io.emit('event', jsonObject)
                        } catch (e) {
                            if (e instanceof SyntaxError)
                                console.error(`\x1b[31mCOULD NOT PARSE company profile: \x1b[0m*${jsonText}*`)
                            else
                                console.error(e)
                        }

                        let totalTimeSoFar = qtyOfNotifications++ * averageProcessingTime + (Date.now() - singleStartTime)
                        averageProcessingTime = totalTimeSoFar / qtyOfNotifications
                    }
                    reqStream.resume()
                } else {
                    io.emit('heartbeat', {})
                }
            })
            .on('end', () => {
                console.error("Company profile stream ended")
                console.timeEnd("Listening on company stream")
            })
    }
}

const companyTypeConversion = {
    'private-unlimited': "Private unlimited company",
    'ltd': "Private limited company",
    'plc': "Public limited company",
    'old-public-company': "Old public company",
    'private-limited-guarant-nsc-limited-exemption': "Private Limited Company by guarantee without share capital, use of 'Limited' exemption",
    'limited-partnership': "Limited partnership",
    'private-limited-guarant-nsc': "Private limited by guarantee without share capital",
    'converted-or-closed': "Converted / closed",
    'private-unlimited-nsc': "Private unlimited company without share capital",
    'private-limited-shares-section-30-exemption': "Private Limited Company, use of 'Limited' exemption",
    'protected-cell-company': "Protected cell company",
    'assurance-company': "Assurance company",
    'oversea-company': "Overseas company",
    'eeig': "European economic interest grouping (EEIG)",
    'icvc-securities': "Investment company with variable capital",
    'icvc-warrant': "Investment company with variable capital",
    'icvc-umbrella': "Investment company with variable capital",
    'registered-society-non-jurisdictional': "Registered society",
    'industrial-and-provident-society': "Industrial and Provident society",
    'northern-ireland': "Northern Ireland company",
    'northern-ireland-other': "Credit union (Northern Ireland)",
    'llp': "Limited liability partnership",
    'royal-charter': "Royal charter company",
    'investment-company-with-variable-capital': "Investment company with variable capital",
    'unregistered-company': "Unregistered company",
    'other': "Other company type",
    'european-public-limited-liability-company-se': "European public limited liability company (SE)",
    'uk-establishment': "UK establishment company",
    'scottish-partnership': "Scottish qualifying partnership",
    'charitable-incorporated-organisation': "Charitable incorporated organisation",
    'scottish-charitable-incorporated-organisation': "Scottish charitable incorporated organisation",
    'further-education-or-sixth-form-college-corporation': "Further education or sixth form college corporation"
}

// some sample companies from the stream to use as an example of the format to expect
const sampleCompanyProfiles: CompanyProfileEvent.CompanyProfileEvent[] = [
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/09940905',
        resource_id: '09940905',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-10-31',
                next_made_up_to: '2021-01-31'
            },
            can_file: true,
            company_name: 'DE LUXE GROUP LIMITED',
            company_number: '09940905',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2021-01-06',
                next_due: '2022-01-20',
                next_made_up_to: '2022-01-06'
            },
            date_of_creation: '2016-01-07',
            etag: 'e5929a49e6c4d3af5141cf6f835c72344a80abfc',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/09940905/filing-history',
                officers: '/company/09940905/officers',
                persons_with_significant_control: '/company/09940905/persons-with-significant-control',
                self: '/company/09940905'
            },
            registered_office_address: {
                address_line_1: '97 Woolwich New Road',
                address_line_2: 'Woolwich',
                country: 'England',
                locality: 'London',
                postal_code: 'SE18 6EF',
                region: 'London'
            },
            sic_codes: ['62090'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990417,
            published_at: '2021-01-28T21:59:04',
            type: 'changed'
        }
    },
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/10547255',
        resource_id: '10547255',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-10-31',
                next_made_up_to: '2021-01-31'
            },
            can_file: true,
            company_name: 'HEALTH RENEW LIMITED',
            company_number: '10547255',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2021-01-02',
                next_due: '2022-01-16',
                next_made_up_to: '2022-01-02'
            },
            date_of_creation: '2017-01-04',
            etag: '79059447c3ce43ee325ea650b7e3bc2eb9f6ba36',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/10547255/filing-history',
                officers: '/company/10547255/officers',
                persons_with_significant_control_statements: '/company/10547255/persons-with-significant-control-statements',
                self: '/company/10547255'
            },
            registered_office_address: {
                address_line_1: '58a Ilford Lane',
                country: 'England',
                locality: 'Ilford',
                postal_code: 'IG1 2JY'
            },
            sic_codes: ['96040'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990426,
            published_at: '2021-01-28T22:00:04',
            type: 'changed'
        }
    }
    ,
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/09966521',
        resource_id: '09966521',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-10-31',
                next_made_up_to: '2021-01-31'
            },
            can_file: true,
            company_name: 'THORNWOOD CONSULTANCY LIMITED',
            company_number: '09966521',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2021-01-24',
                next_due: '2022-02-07',
                next_made_up_to: '2022-01-24'
            },
            date_of_creation: '2016-01-25',
            etag: '9ebf081fb814e47f91e3f8e500511c61848c0f8c',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/09966521/filing-history',
                officers: '/company/09966521/officers',
                persons_with_significant_control: '/company/09966521/persons-with-significant-control',
                self: '/company/09966521'
            },
            registered_office_address: {
                address_line_1: 'A2 Patrick Tobin Business Park Bolton Road',
                address_line_2: 'Wath-Upon-Dearne',
                country: 'England',
                locality: 'Rotherham',
                postal_code: 'S63 7LL'
            },
            sic_codes: ['82990'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990427,
            published_at: '2021-01-28T22:00:03',
            type: 'changed'
        }
    }
    , {
        resource_kind: 'company-profile',
        resource_uri: '/company/11061407',
        resource_id: '11061407',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-08-31',
                next_made_up_to: '2020-11-30'
            },
            can_file: true,
            company_name: 'EVECAS CAPITAL LIMITED',
            company_number: '11061407',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2020-11-12',
                next_due: '2021-11-26',
                next_made_up_to: '2021-11-12'
            },
            date_of_creation: '2017-11-13',
            etag: 'a1baea1067e8bf62e09708c6321c87306016ae67',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/11061407/filing-history',
                officers: '/company/11061407/officers',
                persons_with_significant_control: '/company/11061407/persons-with-significant-control',
                self: '/company/11061407'
            },
            registered_office_address: {
                address_line_1: '51 St. Johns Road',
                country: 'England',
                locality: 'Ipswich',
                postal_code: 'IP4 5DE'
            },
            sic_codes: ['64999'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990428,
            published_at: '2021-01-28T22:00:03',
            type: 'changed'
        }
    }
    ,
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/10502722',
        resource_id: '10502722',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-12-31',
                next_made_up_to: '2021-03-31'
            },
            can_file: true,
            company_name: 'CM1 ACCOUNTANTS LTD',
            company_number: '10502722',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2020-11-28',
                next_due: '2021-12-12',
                next_made_up_to: '2021-11-28'
            },
            date_of_creation: '2016-11-29',
            etag: '91b19e494555733c1d72c5f2893c3e38385646de',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/10502722/filing-history',
                officers: '/company/10502722/officers',
                persons_with_significant_control: '/company/10502722/persons-with-significant-control',
                self: '/company/10502722'
            },
            registered_office_address: {
                address_line_1: '50 50 Victoria Road',
                address_line_2: 'Writtle',
                country: 'United Kingdom',
                locality: 'Chelmsford',
                postal_code: 'CM1 3PA',
                region: 'Essex'
            },
            sic_codes: ['69201'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990456,
            published_at: '2021-01-28T22:01:07',
            type: 'changed'
        }
    },
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/09040685',
        resource_id: '09040685',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2022-02-28',
                next_made_up_to: '2021-05-31'
            },
            can_file: true,
            company_name: 'PHEONIX (UK) CONSULTANCY LTD',
            company_number: '09040685',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2020-05-15',
                next_due: '2021-05-29',
                next_made_up_to: '2021-05-15'
            },
            date_of_creation: '2014-05-15',
            etag: '879328c2bcd59ae8999c38b42b100839e5f2aece',
            jurisdiction: 'england-wales',
            last_full_members_list_date: '2016-05-15',
            links: {
                filing_history: '/company/09040685/filing-history',
                officers: '/company/09040685/officers',
                persons_with_significant_control: '/company/09040685/persons-with-significant-control',
                self: '/company/09040685'
            },
            registered_office_address: {
                address_line_1: '56 Pavilion Way',
                locality: 'Sheffield',
                postal_code: 'S5 6EE',
                region: 'South Yorkshire'
            },
            sic_codes: ['70229'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990458,
            published_at: '2021-01-28T22:01:08',
            type: 'changed'
        }
    },
    {
        resource_kind: 'company-profile',
        resource_uri: '/company/07129789',
        resource_id: '07129789',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-07-31',
                next_made_up_to: '2020-10-31'
            },
            can_file: true,
            company_name: 'AS REQUIRED LIMITED',
            company_number: '07129789',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2021-01-19',
                next_due: '2022-02-02',
                next_made_up_to: '2022-01-19'
            },
            date_of_creation: '2010-01-19',
            etag: 'b4adfbfbaf36b99559a6d79ef945825ac50f791f',
            jurisdiction: 'england-wales',
            last_full_members_list_date: '2016-01-19',
            links: {
                filing_history: '/company/07129789/filing-history',
                officers: '/company/07129789/officers',
                persons_with_significant_control: '/company/07129789/persons-with-significant-control',
                self: '/company/07129789'
            },
            previous_company_names: [[Object]],
            registered_office_address: {
                address_line_1: '17 Malvern Drive',
                country: 'England',
                locality: 'Altrincham',
                postal_code: 'WA14 4NQ',
                region: 'Cheshire'
            },
            sic_codes: ['69201'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990466,
            published_at: '2021-01-28T22:03:02',
            type: 'changed'
        }
    }
    , {
        resource_kind: 'company-profile',
        resource_uri: '/company/09966552',
        resource_id: '09966552',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-10-31',
                next_made_up_to: '2021-01-31'
            },
            can_file: true,
            company_name: 'BRIGHTSTAR BOOKS LIMITED',
            company_number: '09966552',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2020-01-24',
                next_due: '2021-03-07',
                next_made_up_to: '2021-01-24'
            },
            date_of_creation: '2016-01-25',
            etag: 'c5ffec2101e4ef74d051a0117be1245bdb41aa4f',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/09966552/filing-history',
                officers: '/company/09966552/officers',
                persons_with_significant_control: '/company/09966552/persons-with-significant-control',
                self: '/company/09966552'
            },
            registered_office_address: {
                address_line_1: '89 Bury New Road',
                address_line_2: 'Whitefield',
                country: 'United Kingdom',
                locality: 'Manchester',
                postal_code: 'M45 7EG'
            },
            sic_codes: ['58110'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990467,
            published_at: '2021-01-28T22:03:02',
            type: 'changed'
        }
    }
    , {
        resource_kind: 'company-profile',
        resource_uri: '/company/11819836',
        resource_id: '11819836',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-09-30',
                next_made_up_to: '2020-12-31'
            },
            can_file: true,
            company_name: 'SOUTH LONDON FITNESS LIMITED',
            company_number: '11819836',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2020-01-27',
                next_due: '2021-03-10',
                next_made_up_to: '2021-01-27'
            },
            date_of_creation: '2019-02-11',
            etag: '36f5caa3a4e80ae1f59e8ddfad8524dd274e0551',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/11819836/filing-history',
                officers: '/company/11819836/officers',
                persons_with_significant_control: '/company/11819836/persons-with-significant-control',
                self: '/company/11819836'
            },
            registered_office_address: {
                address_line_1: '71-75 Shelton Street',
                address_line_2: 'Covent Garden',
                country: 'England',
                locality: 'London',
                postal_code: 'WC2H 9JQ'
            },
            sic_codes: ['93110'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990468,
            published_at: '2021-01-28T22:03:02',
            type: 'changed'
        }
    }
    , {
        resource_kind: 'company-profile',
        resource_uri: '/company/11793514',
        resource_id: '11793514',
        data: {
            accounts: {
                accounting_reference_date: [Object],
                last_accounts: [Object],
                next_accounts: [Object],
                next_due: '2021-10-31',
                next_made_up_to: '2021-01-31'
            },
            can_file: true,
            company_name: 'STRATEGIC ENERGY LIMITED',
            company_number: '11793514',
            company_status: 'active',
            confirmation_statement: {
                last_made_up_to: '2021-01-27',
                next_due: '2022-02-10',
                next_made_up_to: '2022-01-27'
            },
            date_of_creation: '2019-01-28',
            etag: 'b80d10879def47cfcc6208e1381e574ae5a36189',
            jurisdiction: 'england-wales',
            links: {
                filing_history: '/company/11793514/filing-history',
                officers: '/company/11793514/officers',
                persons_with_significant_control_statements: '/company/11793514/persons-with-significant-control-statements',
                self: '/company/11793514'
            },
            registered_office_address: {
                address_line_1: '17 Yeoman Way',
                address_line_2: 'Hadleigh',
                country: 'England',
                locality: 'Ipswich',
                postal_code: 'IP7 5HW'
            },
            sic_codes: ['70229'],
            type: 'ltd'
        },
        event: {
            timepoint: 22990469,
            published_at: '2021-01-28T22:03:03',
            type: 'changed'
        }
    }

]
