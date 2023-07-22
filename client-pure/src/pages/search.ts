import "../styles/theme.scss"
import "../styles/samples.scss"
import "../styles/events.scss"
import { create, insertMultiple, search } from "@orama/orama"
import { getSampleEvents } from "../scripts/downloadSampleEvents"

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
  },
  components: {
    tokenizer: {
      stemming: false
    }
  }
})

const resultsDiv = document.getElementById("search-results")

function initSearchPage(target: string) {
  const container = document.getElementById(target)
  if (!container) throw new Error("Target does not exist")
}


async function loadEvents() {
  let start = performance.now()
  const events = await getSampleEvents("filings", 10_00)
  console.log("Took", performance.now() - start, "to fetch data")
  start = performance.now()
  await insertMultiple(db, events, 200)
  console.log("Took", performance.now() - start, "to insert events into db")
}

async function performSearch(query: string) {
  const start = performance.now()
  const results = await search(db, {
    term: query,
    facets: { "data.category": {}, "data.type": {}, "data.description": {} }
  })
  console.log("Search took", performance.now() - start, "to query", query)
  console.log(results)
  resultsDiv.innerHTML = `<pre>${JSON.stringify(results, null, 2)}</pre>`
}


const searchBox = document.getElementById("search-query") as HTMLInputElement
const searchButton = document.getElementById("search-button") as HTMLButtonElement
const loadButton = document.getElementById("load-button") as HTMLButtonElement

searchBox.addEventListener("keyup", async () => {
  const query = searchBox.value
  await performSearch(query)
})

searchButton.addEventListener("click", async () => {
  const query = searchBox.value
  await performSearch(query)
})

loadButton.addEventListener("click", async () => {
  await loadEvents()
  const query = searchBox.value
  await performSearch(query)
})
