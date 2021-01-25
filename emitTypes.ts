export interface EmitType {
    source: 'filing-history' | 'company-profile' | 'company-insolvency' | 'company-charges'
    published: Date
    companyNumber: string
    resource_kind: 'filing-history' | 'company-profile' | 'company-insolvency' | 'company-charges'
    companyProfile?: {} | undefined
}

export interface FilingEmit extends EmitType {
    title: string
    description: string
}
