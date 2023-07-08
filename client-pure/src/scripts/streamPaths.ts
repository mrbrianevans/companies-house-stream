export const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers", "company-exemptions", "persons-with-significant-control-statements"])


export const languages = ["go", "typescript", "rust", "python", "java"] as const

export const streamColours = {
  companies: "#e0c88a",
  filings: "#c7c7c7",
  officers: "#e9c069",
  "persons-with-significant-control": "#c7ed8b",
  charges: "#b0cbe3",
  "insolvency-cases": "#e0acb5",
  "disqualified-officers": "#b15050"
}
