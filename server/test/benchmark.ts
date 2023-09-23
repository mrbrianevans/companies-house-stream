import { run, bench } from "mitata"
import assert from "node:assert/strict"

const urls = [
  new URL("/randomCompanyNumbers", "http://localhost:3000"),
  new URL("/events/randomCompanyNumbers", "http://localhost"),
  new URL("/events/randomCompanyNumbers", "https://companies.stream")
]

for (const url of urls) {
  bench(url.toString(), async () => {
    const res = await fetch(url)
    assert(res.ok, "Bad response status code")
  })
}


await run({})
