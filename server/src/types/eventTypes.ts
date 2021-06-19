//TODO: These have the data types, but need mandatory/optional to be added

export declare module CompanyProfileEvent {
  export interface AccountingReferenceDate {
    day: number | string
    month: number | string
  }

  export interface LastAccounts {
    made_up_to?: string
    type:
      | "full"
      | "small"
      | "medium"
      | "group"
      | "dormant"
      | "interim"
      | "initial"
      | "total-exemption-full"
      | "total-exemption-small"
      | "partial-exemption"
      | "audit-exemption-subsidiary"
      | "filing-exemption-subsidiary"
      | "micro-entity"
      | "null"
  }

  export interface NextAccounts {
    due_on: string
    period_end_on: string
    period_start_on: string
  }

  export interface Accounts {
    accounting_reference_date: AccountingReferenceDate | {} // the |{}|{} is to satisfy samples, but should be removed in production
    last_accounts: LastAccounts | {}
    next_accounts: NextAccounts | {}
    next_due: string
    next_made_up_to: string
    overdue?: boolean
  }

  export interface AnnualReturn {
    last_made_up_to: string
    next_due: string
    next_made_up_to: string
    overdue: boolean
  }

  export interface BranchCompanyDetails {
    business_activity: string
    parent_company_name: string
    parent_company_number: string
  }

  export interface ConfirmationStatement {
    last_made_up_to?: string
    next_due: string
    next_made_up_to: string
    overdue?: boolean
  }

  export interface AccountingRequirement {
    foreign_account_type: string
    terms_of_account_publication: string
  }

  export interface AccountPeriodFrom {
    day: number
    month: number
  }

  export interface AccountPeriodTo {
    day: number
    month: number
  }

  export interface MustFileWithin {
    months: number
  }

  export interface Accounts2 {
    account_period_from: AccountPeriodFrom
    account_period_to: AccountPeriodTo
    must_file_within: MustFileWithin
  }

  export interface OriginatingRegistry {
    country: string
    name: string
  }

  export interface ForeignCompanyDetails {
    accounting_requirement: AccountingRequirement
    accounts: Accounts2
    business_activity: string
    company_type: string
    governed_by: string
    is_a_credit_finance_institution: boolean
    originating_registry: OriginatingRegistry
    registration_number: string
  }

  export interface Links {
    persons_with_significant_control?: string
    persons_with_significant_control_statements?: string
    registers?: string
    self: string
    charges?: string
    filing_history: string
    officers: string
  }

  export interface PreviousCompanyName {
    ceased_on: string
    effective_from: string
    name: string
  }

  export interface RegisteredOfficeAddress {
    address_line_1: string
    address_line_2?: string
    care_of?: string
    country?: string
    locality: string
    po_box?: string
    postal_code: string
    premises?: string
    region?: string
  }

  export interface Data {
    accounts: Accounts
    annual_return?: AnnualReturn
    branch_company_details?: BranchCompanyDetails
    can_file: boolean
    company_name: string
    company_number: string
    company_status: string
    company_status_detail?: string
    confirmation_statement: ConfirmationStatement
    date_of_cessation?: string
    date_of_creation: string
    etag: string
    foreign_company_details?: ForeignCompanyDetails
    has_been_liquidated?: boolean
    has_charges?: boolean
    has_insolvency_history?: boolean
    is_community_interest_company?: boolean
    jurisdiction: string
    last_full_members_list_date?: string
    links: Links
    previous_company_names?: PreviousCompanyName[] | [[Object]]
    registered_office_address: RegisteredOfficeAddress
    registered_office_is_in_dispute?: boolean
    sic_codes: string[]
    type: string
    undeliverable_registered_office_address?: boolean
  }

  export interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  export interface CompanyProfileEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: string
    resource_uri: string
  }
}

export declare module FilingEvent {
  export interface Annotation {
    annotation: string
    date: string
    description: string
    category: "annotation"
    description_values: { description: string }
    type: "ANNOTATION"
  }

  export interface AssociatedFiling {
    date: string
    description: string
    type: string
  }

  export interface Links {
    document_metadata?: string
    self: string
  }

  export interface Resolution {
    category: string
    description: string
    document_id: string
    receive_date: string
    subcategory: string
    type: string
  }

  export interface Data {
    annotations?: Annotation[]
    associated_filings?: AssociatedFiling[]
    barcode: string
    category:
      | "accounts"
      | "address"
      | "annual-return"
      | "capital"
      | "change-of-name"
      | "incorporation"
      | "liquidation"
      | "miscellaneous"
      | "mortgage"
      | "officers"
      | "resolution"
      | "confirmation-statement"
    date: string
    description?: string
    description_values?: {}
    links: Links
    pages?: number
    paper_filed?: boolean
    resolutions?: Resolution[]
    subcategory?: string
    transaction_id: string
    type: string
  }

  export interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: "changed" | "deleted"
  }

  export interface FilingEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "filing-history"
    resource_uri: string
  }
}

export declare module InsolvencyEvent {
  export interface Date {
    date: string
    type: string
  }

  export interface Links {
    charge: string
  }

  export interface Address {
    address_line_1: string
    address_line_2?: string
    country?: string
    locality: string
    postal_code?: string
    region?: string
  }

  export interface Practitioner {
    address: Address
    appointed_on?: string
    ceased_to_act_on?: string
    name: string
    role: string
  }

  export interface Case {
    dates?: Date[]
    links?: Links
    notes?: string[]
    number: number | string
    practitioners?: Practitioner[]
    type: string
  }

  export interface Data {
    cases: Case[]
    etag: string
    status?: string
  }

  export interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  export interface InsolvencyEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "company-insolvency"
    resource_uri: string
  }
}

export declare module ChargesEvent {
  export interface Classification {
    description: string
    type: string
  }

  export interface Link {
    case: string
  }

  export interface InsolvencyCas {
    case_number: number
    links: Link[]
    transaction_id: number
  }

  export interface Link2 {
    self: string
  }

  export interface Particular {
    chargor_acting_as_bare_trustee?: boolean
    contains_fixed_charge?: boolean
    contains_floating_charge?: boolean
    contains_negative_pledge: boolean
    description?: string
    floating_charge_covers_all?: boolean
    type?: string
  }

  export interface PersonsEntitled {
    name: string
  }

  export interface ScottishAlteration {
    description: string
    has_alterations_to_order: boolean
    has_alterations_to_prohibitions: boolean
    has_alterations_to_provisions: boolean
    type: string
  }

  export interface SecuredDetail {
    description: string
    type: string
  }

  export interface Link3 {
    filing: string
    insolvency_case?: string
  }

  export interface Transaction {
    delivered_on: string
    filing_type: string
    insolvency_case_number?: number
    links: Link3
    transaction_id?: number
  }

  export interface Data {
    acquired_on?: string
    assests_ceased_released?: string
    charge_code: string
    charge_number: number
    classification: Classification
    covering_instrument_date?: string
    created_on: string
    delivered_on: string
    etag: string
    id?: string
    insolvency_cases?: InsolvencyCas[]
    links: Link2
    more_than_four_persons_entitled?: boolean
    particulars: Particular
    persons_entitled: PersonsEntitled[]
    resolved_on?: string
    satisfied_on?: string
    scottish_alterations?: ScottishAlteration[]
    secured_details?: SecuredDetail[]
    status: string
    transactions: Transaction[]
  }

  export interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  export interface ChargesEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: string
    resource_uri: string
  }
}

export declare module PscEvent {
  /** the psc address
   *
   */
  export interface Address {
    address_line_1: string
    address_line_2?: string
    care_of?: string
    country?: string
    locality?: string
    po_box?: string
    postal_code: string
    premises: string
    region?: string
  }

  export interface DateOfBirth {
    day?: number
    month: number
    year: number
  }

  export interface Identification {
    country_registered?: string
    legal_authority: string
    legal_form: string
    place_registered?: string
    registration_number?: string
  }

  export interface Links {
    self: string
    statement?: string
  }

  export interface NameElements {
    forename?: string
    other_forenames?: string
    surname: string
    title?: string
  }

  export interface Data {
    address: Address
    ceased?: boolean
    ceased_on?: string
    country_of_residence?: string
    date_of_birth: DateOfBirth
    description?: "super-secure-persons-with-significant-control"
    etag: string
    identification: Identification
    kind?:
      | "individual-person-with-significant-control"
      | "corporate-entity-person-with-significant-control"
      | "legal-person-with-significant-control"
      | "super-secure-person-with-significant-control"
    links: Links
    name: string
    name_elements: NameElements
    nationality?: string
    natures_of_control: string[]
    notified_on: string
  }

  export interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: "changed" | "deleted"
  }

  export interface PscEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "psc-notified" | "charges" //not sure what this actually is
    resource_uri: string
  }
}

// export interface CompanyProfileEvent {
//     resource_kind: string,
//     resource_uri: string,
//     resource_id: string,
//     data: {
//         accounts: {
//             accounting_reference_date: {
//                 day: number,
//                 month: number
//             },
//             overdue: boolean,
//             last_accounts?: {
//                 made_up_to: string;
//                 type: 'full' |
//                     'small' |
//                     'medium' |
//                     'group' |
//                     'dormant' |
//                     'interim' |
//                     'initial' |
//                     'total-exemption-full' |
//                     'total-exemption-small' |
//                     'partial-exemption' |
//                     'audit-exemption-subsidiary' |
//                     'filing-exemption-subsidiary' |
//                     'micro-entity'
//             },
//             next_due?: string,
//             next_made_up_to: string
//         },
//         can_file: boolean,
//         company_name: string,
//         company_number: string,
//         company_status: string,
//         confirmation_statement: { next_due: string, next_made_up_to: string },
//         date_of_creation: string,
//         etag: string,
//         jurisdiction: string,
//         links: {
//             filing_history: string,
//             officers: string,
//             persons_with_significant_control: string,
//             self: string
//         },
//         registered_office_address: {
//             address_line_1: string,
//             address_line_2: string,
//             country: string,
//             locality: string,
//             postal_code: string
//         },
//         sic_codes: [string],
//         type: string
//     },
//     event: {
//         timepoint: number,
//         published_at: string,
//         type: string
//     }
// }
