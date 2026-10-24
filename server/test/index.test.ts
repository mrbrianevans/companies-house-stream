import assert, { equal } from "node:assert/strict"
import { describe, it } from "bun:test"

// sends a request to each REST endpoint and checks the response code and the basic structure of the body
// const url = "https://companies.stream"
const url = "http://localhost:3000"

describe("request endpoints from API", () => {
  it("should respond to a health check", async () => {
    const res = await fetch(new URL("/health", url))
    equal(res.status, 200, "Response status not 200")
    const health = await res.json()
    assert("filings" in health)
    assert("companies" in health)
    assert("currentWsConnections" in health)
  })

  it("should provide random company numbers", async () => {
    const res = await fetch(new URL("/randomCompanyNumbers", url))
    equal(res.status, 200, "Response status not 200")
    const [companyNumber] = await res.json()
    equal(companyNumber.length, 8)
  })

  it("should be able to download filings stream history", async () => {
    const res = await fetch(new URL("/downloadHistory/filings?qty=1", url))
    equal(res.status, 200, "Response status not 200")
    const events = await res.json()
    equal(events.length, 1)
    assert("resource_uri" in events.at(0), "Key missing from event returned in history")
  })
  it("should be able get stream stats for filings", async () => {
    const res = await fetch(new URL("/stats/filings", url))
    equal(res.status, 200, "Response status not 200")
    const stats = await res.json()
    const dates = Object.keys(stats)
    equal(typeof stats[dates[0]], "number")
  })
  it("should be able get stream resource_kinds for PSCs", async () => {
    const res = await fetch(new URL("/resourceKinds/persons-with-significant-control", url))
    equal(res.status, 200, "Response status not 200")
    const resourceKindStats = await res.json()
    const resourceKinds = Object.keys(resourceKindStats)
    equal(typeof resourceKindStats[resourceKinds[0]], "number")
  })
  it("should be able get schema for filing events", async () => {
    const res = await fetch(new URL("/schemas", url))
    equal(res.status, 200, "Response status not 200")
    const schemas = await res.json()
    assert("filing-history" in schemas)
    const schema = schemas["filing-history"]
    equal(schema.type, "object")
    equal(schema.properties.description.type, "string")
  })
  it("should be able get visitors total stats", async () => {
    const res = await fetch(new URL(`/visitors`, url))
    equal(res.status, 200, "Response status not 200")
    const visitors = await res.json()
    assert("today" in visitors)
    equal(typeof visitors.today, "number")
    assert("total" in visitors)
    equal(typeof visitors.total, "number")
  })
  it("should be able get visitors for a date", async () => {
    const date = new Date().toISOString().slice(0, 10)
    const res = await fetch(new URL(`/visitors/${date}`, url))
    equal(res.status, 200, "Response status not 200")
    const visitors = await res.json()
    assert(date in visitors)
    equal(typeof visitors[date], "number")
  })
})
