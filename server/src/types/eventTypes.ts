declare module CompanyProfileEvent {
  interface AccountingReferenceDate {
    day: number | string
    month: number | string
  }

  interface LastAccounts {
    made_up_to?: string
    period_end_on: string
    period_start_on: string
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
      | "unaudited-abridged"
  }

  interface NextAccounts {
    due_on: string
    period_end_on: string
    period_start_on: string
  }

  interface Accounts {
    accounting_reference_date: AccountingReferenceDate
    last_accounts: LastAccounts | { type: "null" }
    next_accounts: NextAccounts
    next_due: string
    next_made_up_to: string
    overdue?: boolean
  }

  interface AnnualReturn {
    last_made_up_to: string
    next_due: string
    next_made_up_to: string
    overdue: boolean
  }

  interface BranchCompanyDetails {
    business_activity: string
    parent_company_name: string
    parent_company_number: string
  }

  interface ConfirmationStatement {
    last_made_up_to?: string
    next_due: string
    next_made_up_to: string
    overdue?: boolean
  }

  interface AccountingRequirement {
    foreign_account_type: string
    terms_of_account_publication: string
  }

  interface AccountPeriodFrom {
    day: number
    month: number
  }

  interface AccountPeriodTo {
    day: number
    month: number
  }

  interface MustFileWithin {
    months: number
  }

  interface Accounts2 {
    account_period_from: AccountPeriodFrom
    account_period_to: AccountPeriodTo
    must_file_within: MustFileWithin
  }

  interface OriginatingRegistry {
    country: string
    name: string
  }

  interface ForeignCompanyDetails {
    accounting_requirement: AccountingRequirement
    accounts: Accounts2
    business_activity: string
    company_type: string
    governed_by: string
    is_a_credit_finance_institution: boolean
    originating_registry: OriginatingRegistry
    registration_number: string
  }

  interface Links {
    persons_with_significant_control?: string
    persons_with_significant_control_statements?: string
    registers?: string
    self: string
    charges?: string
    filing_history: string
    officers?: string
  }

  interface PreviousCompanyName {
    ceased_on: string
    effective_from: string
    name: string
  }

  interface RegisteredOfficeAddress {
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

  interface Data {
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

  interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  interface CompanyProfileEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "company-profile"
    resource_uri: string
  }
}

declare module FilingEvent {
  interface Annotation {
    annotation: string
    date: string
    description: string
    category: "annotation"
    description_values: { description: string }
    type: "ANNOTATION"
  }

  interface AssociatedFiling {
    date: string
    description: string
    type: string
  }

  interface Links {
    document_metadata?: string
    self: string
  }

  interface Resolution {
    category: string
    description: string
    document_id: string
    receive_date: string
    subcategory: string
    type: string
  }

  interface Data {
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

  interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: "changed" | "deleted"
  }

  interface FilingEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "filing-history"
    resource_uri: string
  }
}

declare module InsolvencyEvent {
  interface Date {
    date: string
    type: string
  }

  interface Links {
    charge: string
  }

  interface Address {
    address_line_1: string
    address_line_2?: string
    country?: string
    locality: string
    postal_code?: string
    region?: string
  }

  interface Practitioner {
    address: Address
    appointed_on?: string
    ceased_to_act_on?: string
    name: string
    role: string
  }

  interface Case {
    dates?: Date[]
    links?: Links
    notes?: string[]
    number: number | string
    practitioners?: Practitioner[]
    type: string
  }

  interface Data {
    cases: Case[]
    etag: string
    status?: string
  }

  interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  interface InsolvencyEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "company-insolvency"
    resource_uri: string
  }
}

declare module ChargesEvent {
  interface Classification {
    description: string
    type: string
  }

  interface Link {
    case: string
  }

  interface InsolvencyCas {
    case_number: number
    links: Link[]
    transaction_id: number
  }

  interface Link2 {
    self: string
  }

  interface Particular {
    chargor_acting_as_bare_trustee?: boolean
    contains_fixed_charge?: boolean
    contains_floating_charge?: boolean
    contains_negative_pledge: boolean
    description?: string
    floating_charge_covers_all?: boolean
    type?: string
  }

  interface PersonsEntitled {
    name: string
  }

  interface ScottishAlteration {
    description: string
    has_alterations_to_order: boolean
    has_alterations_to_prohibitions: boolean
    has_alterations_to_provisions: boolean
    type: string
  }

  interface SecuredDetail {
    description: string
    type: string
  }

  interface Link3 {
    filing: string
    insolvency_case?: string
  }

  interface Transaction {
    delivered_on: string
    filing_type: string
    insolvency_case_number?: number
    links: Link3
    transaction_id?: number
  }

  interface Data {
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

  interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: string
  }

  interface ChargesEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "company-charges"
    resource_uri: string
  }
}

declare module PscEvent {
  /** the psc address
   *
   */
  interface Address {
    address_line_1: string
    address_line_2?: string
    care_of?: string
    country?: string
    locality?: string
    po_box?: string
    postal_code?: string
    premises: string
    region?: string
  }

  interface DateOfBirth {
    day?: number
    month: number
    year: number
  }

  interface Identification {
    country_registered?: string
    legal_authority: string
    legal_form: string
    place_registered?: string
    registration_number?: string
  }

  interface Links {
    self: string
    statement?: string
  }

  interface NameElements {
    forename?: string
    other_forenames?: string
    surname: string
    title?: string
  }

  interface Data {
    address: Address
    ceased?: boolean
    ceased_on?: string
    country_of_residence?: string
    date_of_birth?: DateOfBirth
    description?: "super-secure-persons-with-significant-control"
    etag: string
    identification?: Identification
    kind?:
      | "individual-person-with-significant-control"
      | "corporate-entity-person-with-significant-control"
      | "legal-person-with-significant-control"
      | "super-secure-person-with-significant-control"
    links: Links
    name: string
    name_elements?: NameElements
    nationality?: string
    natures_of_control: string[]
    notified_on: string
  }

  interface Event {
    fields_changed?: string[]
    published_at: string
    timepoint: number
    type: "changed" | "deleted"
  }

  interface PscEvent {
    data: Data
    event: Event
    resource_id: string
    resource_kind: "company-psc-corporate" | "company-psc-individual"
    resource_uri: string
  }
}

declare module OfficerEvent {
  interface OfficerEvent {
    resource_kind: "company-officers"
    resource_uri: string
    resource_id: string
    data: IOfficerData
    event: IOfficerEvent
  }

  interface IOfficerData {
    address: IOfficerAddress
    appointed_on?: string
    country_of_residence?: string
    date_of_birth?: IOfficerDate_of_birth
    links: IOfficerLinks
    name: string
    nationality?: string
    occupation?: string
    officer_role: string
    resigned_on?: string
    identification?: IOfficerIdentification
  }

  interface IOfficerIdentification {
    identification_type: string
    registration_number: string
    legal_authority?: string
    legal_form?: string
    place_registered?: string
  }

  interface IOfficerAddress {
    address_line_1?: string
    address_line_2?: string
    country?: string
    locality: string
    postal_code: string
    premises?: string
    region?: string
    care_of?: string
  }

  interface IOfficerDate_of_birth {
    month: number
    year: number
  }

  interface IOfficerLinks {
    self: string
  }

  interface IOfficerEvent {
    timepoint: number
    published_at: string
    type: string
  }
}

declare module ExemptionsEvent {
  //TODO: fill out this interface with an auto-generated one based on recent events on the stream
  interface ExemptionsEvent {
    data: IExemptionsData
    event: IExemptionsEvent
    resource_id: string
    resource_kind: "company-exemptions"
    resource_uri: string
  }

  interface IExemptionsEvent {
    timepoint: number
    published_at: string
    type: string
  }

  interface IExemptionsData {
    kind: "exemptions"

    [key: string]: unknown
  }
}

type AnyEvent =
  CompanyProfileEvent.CompanyProfileEvent
  | FilingEvent.FilingEvent
  | PscEvent.PscEvent
  | InsolvencyEvent.InsolvencyEvent
  | ChargesEvent.ChargesEvent
  | OfficerEvent.OfficerEvent
  | ExemptionsEvent.ExemptionsEvent;
//TODO: add interfaces for other streams that have since been added. eg PSC statements.
export type { CompanyProfileEvent, FilingEvent, PscEvent, InsolvencyEvent, ChargesEvent, OfficerEvent, AnyEvent }

