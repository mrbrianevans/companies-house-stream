export interface EmitType {
  source:
    | "filing-history"
    | "company-profile"
    | "company-insolvency"
    | "company-charges"
  published: Date
  companyNumber: string
  resource_kind:
    | "filing-history"
    | "company-profile"
    | "company-insolvency"
    | "company-charges"
  companyProfile?: {
    name: string
    number: string
    streetaddress: string
    county?: string
    country?: string
    postcode: string
    category: string
    origin: string
    status: string
    date: string
    updated: string
  }
}

export interface FilingEmit extends EmitType {
  title: string
  description: string
}
