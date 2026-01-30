import formatString from "string-template";

let filingDescriptions; // dynamically import massive JSON document
let imported = false;

export function formatFilingDescription(transaction) {
  if (!filingDescriptions && !imported) {
    imported = true;
    import("../assets/filingDescriptions.json").then((f) => (filingDescriptions = f.default));
  }
  //todo: format dates properly and add currency to end for statement-of-capital
  if (filingDescriptions && transaction.description in filingDescriptions)
    return formatString(
      filingDescriptions[transaction.description],
      transaction.description_values,
    );
  else if (transaction.description === "legacy")
    return transaction.description_values?.description ?? transaction.description;
  else {
    if (filingDescriptions)
      console.warn({ transaction }, "Filing description not found for " + transaction.description);
    return transaction.description;
  }
}
