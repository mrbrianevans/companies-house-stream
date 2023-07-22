import { create, insertMultiple, search } from "@orama/orama"

async function getSampleEvents(streamPath, qty = 100) {
  const query = new URLSearchParams({ qty: qty.toFixed(0) })
  const events = await fetch("https://companies.stream/events/downloadHistory/" + streamPath + "?" + query.toString()).then(r => r.json())
  return events
}


const db = await create({
  schema: {
    resource_kind: "string",
    resource_uri: "string",
    resource_id: "string",
    data: {
      barcode: "string",
      category: "string",
      date: "string",
      description: "string",
      description_values: {
        made_up_date: "string"
      },
      links: {
        document_metadata: "string",
        self: "string"
      },
      pages: "number",
      transaction_id: "string",
      type: "string"
    },
    event: {
      fields_changed: "string[]",
      published_at: "string",
      type: "string"
    }
  }

})


async function loadEvents() {
  let start = performance.now()
  const events = await getSampleEvents("filings", 10_000)
  console.log("Took", performance.now() - start, "to fetch data")
  start = performance.now()
  await insertMultiple(db, events, 500)
  console.log("Took", performance.now() - start, "to insert events into db")
}

async function performSearch(query) {
  const start = performance.now()
  const results = await search(db, { term: query })
  console.log("Search took", performance.now() - start, "to query", query)
  console.log(results)
}

await loadEvents()
await performSearch("090775")
