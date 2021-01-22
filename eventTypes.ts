export interface BasicCompanyEvent  {
  resource_kind: string,
  resource_uri: string,
  resource_id: string,
  data: {
    accounts: {
      accounting_reference_date: {},
      last_accounts: {},
      next_accounts: {},
      next_due: string,
      next_made_up_to: string
    },
    can_file: boolean,
    company_name: string,
    company_number: string,
    company_status: string,
    confirmation_statement: { next_due: string, next_made_up_to: string },
    date_of_creation: string,
    etag: string,
    jurisdiction: string,
    links: {
      filing_history: string,
      officers: string,
      persons_with_significant_control: string,
      self: string
    },
    registered_office_address: {
      address_line_1: string,
      address_line_2: string,
      country: string,
      locality: string,
      postal_code: string
    },
    sic_codes: [ string ],
    type: string
  },
  event: {
    timepoint: number,
    published_at: string,
    type: string
  }
}
