import formatString from 'string-template'

let filingDescriptions = {} // dynamically import massive JSON document
import('../assets/filingDescriptions.json').then(f=>filingDescriptions = f.default)

export function formatFilingDescription(transaction){
  //todo: format dates properly and add currency to end for statement-of-capital
  if(transaction.description in filingDescriptions)
    return formatString(filingDescriptions[transaction.description], transaction.description_values)
  else if(transaction.description === 'legacy') return transaction.description_values?.description ?? transaction.description
  else{
    console.warn({transaction},'Filing description not found for '+transaction.description)
    return transaction.description
  }
}
