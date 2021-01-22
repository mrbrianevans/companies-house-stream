import {CompanyProfileEvent} from "../../eventTypes";

const faker = require('faker')


// @ts-ignore
export const generateFakeCompanyProfile: () => CompanyProfileEvent.CompanyProfileEvent = () => {
    const companyNumber = faker.random.number({
        min: 999999,
        max: 13999999
    }).toString().padStart(8, '0')
    return (
        {
            "data": {
                "accounts": {
                    "accounting_reference_date": {
                        "day": faker.random.number({min: 1, max: 31}),
                        "month": faker.random.number({min: 1, max: 12})
                    },
                    "last_accounts": {
                        "made_up_to": faker.date.past().toDateString(),
                        "type": faker.random.arrayElement([
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
                        ])
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
                "company_number": "string",
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
                    "persons_with_significant_control": "/company/" + companyNumber + '/persons-with-significant-control',
                    "persons_with_significant_control_statements": "/company/" + companyNumber + '/persons-with-significant-control/statements',
                    "registers": "/company/" + companyNumber + '/registers',
                    "self": "/company/" + companyNumber
                },
                "previous_company_names": [
                    {
                        "ceased_on": "date",
                        "effective_from": "date",
                        "name": faker.company.companyName()
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
                "published_at": "date-time",
                "timepoint": "integer",
                "type": "string"
            },
            "resource_id": faker.random.uuid(),
            "resource_kind": "company-profile",
            "resource_uri": "/company/" + companyNumber
        }
    )
}

// testing types with an actual record
const e: CompanyProfileEvent.CompanyProfileEvent = {
    "resource_kind": "company-profile",
    "resource_uri": "/company/12370847",
    "resource_id": "12370847",
    "data": {
        "accounts": {
            "accounting_reference_date": {"day": "31", "month": "12"},
            "last_accounts": {"type": "null"},
            "next_accounts": {
                "due_on": "2021-09-19",
                "period_end_on": "2020-12-31",
                "period_start_on": "2019-12-19"
            },
            "next_due": "2021-09-19",
            "next_made_up_to": "2020-12-31"
        },
        "can_file": true,
        "company_name": "TJW HOLDINGS LIMITED",
        "company_number": "12370847",
        "company_status": "active",
        "confirmation_statement": {"next_due": "2021-01-29", "next_made_up_to": "2020-12-18"},
        "date_of_creation": "2019-12-19",
        "etag": "1653782425e0dca8ce84d38c51b310b8a138839d",
        "has_charges": true,
        "jurisdiction": "england-wales",
        "links": {
            "charges": "/company/12370847/charges",
            "filing_history": "/company/12370847/filing-history",
            "officers": "/company/12370847/officers",
            "persons_with_significant_control": "/company/12370847/persons-with-significant-control",
            "self": "/company/12370847"
        },
        "registered_office_address": {
            "address_line_1": "3 Bank Buildings",
            "address_line_2": "149 High Street",
            "country": "England",
            "locality": "Cranleigh",
            "postal_code": "GU6 8BB",
            "region": "Surrey"
        },
        "sic_codes": ["64209"],
        "type": "ltd"
    },
    "event": {"timepoint": 22769811, "published_at": "2021-01-22T17:03:03", "type": "changed"}
}
