import { getCompanyNumber } from "./saveCompanyNumber"
import { expect, describe, it } from "bun:test"
import { AnyEvent } from "../types/eventTypes"

describe("get company number from events", () => {
  it("should get company number from filing event", () => {
    const companyNumber = getCompanyNumber(sampleEvents.filings, "filings")
    expect(companyNumber).toBe("10620794")
  })
  it("should get company number from companies event", () => {
    const companyNumber = getCompanyNumber(sampleEvents.companies, "companies")
    expect(companyNumber).toBe("05954546")
  })
  it("should get company number from exemptions event", () => {
    const companyNumber = getCompanyNumber(sampleEvents.exemptions, "company-exemptions")
    expect(companyNumber).toBe("14438833")
  })
})

const sampleEvents: Record<string, AnyEvent> = {
  filings: {
    "resource_kind": "filing-history",
    "resource_uri": "/company/10620794/filing-history/MzM5ODkyOTYzNmFkaXF6a2N4",
    "resource_id": "MzM5ODkyOTYzNmFkaXF6a2N4",
    "data": {
      "barcode": "XCFK6VA9",
      "category": "accounts",
      "date": "2023-11-04",
      "description": "accounts-with-accounts-type-dormant",
      "description_values": {
        "made_up_date": "2023-02-28"
      },
      "links": {
        "document_metadata": "https://frontend-doc-api.company-information.service.gov.uk/document/xvJsYKTWjnevji-qZ4WIsluwUQWzTeoeyCQfv1zvo_0",
        "self": "/company/10620794/filing-history/MzM5ODkyOTYzNmFkaXF6a2N4"
      },
      "pages": 2,
      "transaction_id": "MzM5ODkyOTYzNmFkaXF6a2N4",
      "type": "AA"
    },
    "event": {
      "fields_changed": [
        "links.document_metadata"
      ],
      "timepoint": 140062688,
      "published_at": "2023-11-04T14:33:31",
      "type": "changed"
    }
  },
  companies: {
    "resource_kind": "company-profile",
    "resource_uri": "/company/05954546",
    "resource_id": "05954546",
    "data": {
      "accounts": {
        "accounting_reference_date": {
          "day": "30",
          "month": "09"
        },
        "last_accounts": {
          "made_up_to": "2022-09-30",
          "period_end_on": "2022-09-30",
          "period_start_on": "2021-10-01",
          "type": "micro-entity"
        },
        "next_accounts": {
          "due_on": "2024-06-30",
          "period_end_on": "2023-09-30",
          "period_start_on": "2022-10-01"
        },
        "next_due": "2024-06-30",
        "next_made_up_to": "2023-09-30"
      },
      "can_file": true,
      "company_name": "GLENCOYNE ENGINEERING LTD",
      "company_number": "05954546",
      "company_status": "active",
      "confirmation_statement": {
        "last_made_up_to": "2023-10-03",
        "next_due": "2024-10-17",
        "next_made_up_to": "2024-10-03"
      },
      "date_of_creation": "2006-10-03",
      "etag": "055ef4b361baa737e96bdaf5e7c0cb9b1ba31b3b",
      "jurisdiction": "england-wales",
      "last_full_members_list_date": "2015-10-03",
      "links": {
        "filing_history": "/company/05954546/filing-history",
        "officers": "/company/05954546/officers",
        "persons_with_significant_control": "/company/05954546/persons-with-significant-control",
        "self": "/company/05954546"
      },
      "registered_office_address": {
        "address_line_1": "Unit10 Heath Road Industrial Estate",
        "address_line_2": "Banham",
        "locality": "Norwich",
        "postal_code": "NR16 2HS"
      },
      "sic_codes": [
        "45200"
      ],
      "type": "ltd"
    },
    "event": {
      "timepoint": 68805561,
      "published_at": "2023-11-04T14:33:29",
      "type": "changed"
    }
  },
  exemptions: {
    "resource_kind": "company-exemptions",
    "resource_uri": "company/14438833/exemptions",
    "resource_id": "14438833",
    "data": {
      "etag": "16ee396e2f6a8b255fa09036a230a76b6895277d",
      "exemptions": {
        "disclosure_transparency_rules_chapter_five_applies": {
          "exemption_type": "disclosure-transparency-rules-chapter-five-applies",
          "items": [
            {
              "exempt_from": "2022-10-24"
            }
          ]
        }
      },
      "kind": "exemptions",
      "links": {
        "self": "/company/14438833/exemptions"
      }
    },
    "event": {
      "timepoint": 2401,
      "published_at": "2023-11-03T22:13:03.742120Z",
      "type": "changed"
    }
  }
} as const
