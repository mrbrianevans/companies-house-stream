let connected = false

let closeSocket

/** Opens a websocket and returns a function to close the socket */
function openSocket() {
  const socket = new WebSocket("ws://localhost:3000/events")
// Connection opened
  socket.addEventListener("open", function(event) {
    setConnected(true)
  })

  socket.addEventListener("close", function(event) {
    setConnected(false)
  })

// Listen for messages
  socket.addEventListener("message", async function(event) {
    const data = JSON.parse(event.data)
    await pushEvent(data)
  })
  return () => socket.close()
}

closeSocket = openSocket()
setInterval(() => {
  document.querySelector("#clock").innerHTML = new Date().toLocaleTimeString()
}, 1000)
const setConnected = (bool) => {
  connected = bool
  document.querySelector("#connection-status").innerHTML = connected
    ? "Connected"
    : "Disconnected"
  document.querySelector("#connection-status").className = connected
    ? "connected"
    : "disconnected"
  document.querySelector("#connection-status").onclick = () => {
    console.log("Button pressed, connection:", connected)
    if (connected) closeSocket()
    else closeSocket = openSocket()
  }
}


const pushEvent = async (e) => {
  document.querySelector("#notification-counter").innerHTML = (
    Number(document.querySelector("#notification-counter").innerHTML) + 1
  ).toString()
  const eventCard = document.createElement("div")
  let column = "companies"
  switch (e.resource_kind || e.source) {
    case "company-profile": // layout for company profile change card
      eventCard.innerHTML = await companyProfileCard(e)
      column = "companies"
      break
    case "filing-history":
      eventCard.innerHTML = await filingHistoryCard(e)
      column = "filings"
      break
    case "company-charges":
      eventCard.innerHTML = await chargesCard(e)
      column = "charges"
      break
    case "company-insolvency":
      eventCard.innerHTML = await insolvencyCard(e)
      column = "insolvencies"
      break
    case "company-officers":
      eventCard.innerHTML = await officerCard(e)
      column = "officers"
      break
    case "company-psc-individual":
    case "company-psc-corporate":
      eventCard.innerHTML = await pscCard(e)
      column = "psc"
      break
    default:
      eventCard.innerHTML = `
        <div class="alert"><h3>New format of event!</h3>
        <pre>${e.resource_kind}</pre></div>
        `
      break
  }
  eventCard.className = "event"
  let events = document.getElementById(column)
  if (events.childElementCount === 15) events.removeChild(events.lastChild)
  const heading = document.querySelector(`#${column}>h3`)
  heading.insertAdjacentElement("afterend", eventCard)
  setTimeout(() => events.removeChild(eventCard), 60_000) // remove after wait time
}
// const heartbeat = () => {
//   const eventCard = document.createElement("div")
//   eventCard.innerHTML =
//     "<div class='heart-outer'><div class='heart1'></div><div class='heart2'></div><div class='heart3'></div></div>"
//   eventCard.className = "heartbeat"
//   let heartbeats = document.getElementById('heartbeats')
//   if (heartbeats.childElementCount === 15) heartbeats.removeChild(heartbeats.lastChild)
//   heartbeats.insertAdjacentElement("afterbegin", eventCard)
//   setTimeout(()=>heartbeats.removeChild(eventCard), 30_000)
// }

const functionUrl = "/getCompanyInfo?company_number="
const filingHistoryCard = async (event) => {
  // const { companyProfile } = event
  const companyNumber = event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/filing-history/
  )[1]
  const { description } = event.data
  // const description = await fetch("/getFilingDescription", {
  //   method: "POST",
  //   headers: {
  //     "content-type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     description: event.data.description,
  //     description_values: event.data.description_values,
  //   }),
  // })
  //   .then((j) => j.json())
  //   .then((j) => j.formattedDescription)
  //   .catch(console.error)
  const e = {
    companyNumber,
    // companyProfile,
    description: description ?? event.data.description,
    published: new Date(event.event.published_at),
    resource_kind: event.resource_kind,
    source: event.resource_kind,
    title: event.data.category
  }
  return `
      <div class="filing-card">
    <div class="row">
      <h3>${e.companyProfile?.name || e.companyNumber}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${e.description}</p>
    <p>${e.title} published at ${e.published.toLocaleTimeString()}</p>
    </div>
        `
}

const companyProfileCard = async (event) => {
  const companyNumber = event.data.company_number
  // const companyProfile = await fetch(functionUrl+companyNumber).then(r=>r.json())
  const newCompany =
    new Date(event.data.date_of_creation).valueOf() > Date.now() - 86400000
  return `<div class="companies-card"><div class="row">
      <h3>${event.data.company_name}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${
    event.data.company_number
  }" target="_blank">${event.data.company_number}</a></code></sub>
    </div>
    <p class="new-company">${newCompany ? "New company" : ""} ${
    event.event.fields_changed ? event.event.fields_changed.join(", ") : ""
  }</p>
    <p>${event.event.type} ${event.resource_kind} at ${new Date(
    event.event.published_at
  ).toLocaleTimeString()}</p>
    </div>`
}

const officerCard = async (event) => {
  const companyProfile = event.companyProfile
  const [, companyNumber] = event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/appointments/
  )
  const resigned = event.data.resigned_on !== undefined
  return `<div class="officer-card"><div class="row">
      <h3>${companyProfile?.name ?? companyNumber}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${event.data.name} appointed ${event.data.officer_role} on ${
    event.data.appointed_on
  }</p>
	${resigned ? `<b>Resigned on ${event.data.resigned_on}</b>` : ""}
    <p>${event.resource_kind} at ${new Date(
    event.event.published_at
  ).toLocaleTimeString()}</p>
    </div>`
}

const pscCard = async (event) => {
  const companyProfile = event.companyProfile
  const [, companyNumber] = event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/persons-with-significant-control/
  )
  const ceased = event.data.ceased_on !== undefined
  return `<div class="psc-card"><div class="row">
      <h3>${companyProfile?.name ?? companyNumber}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${event.data.name} notified on ${event.data.notified_on}</p>
	${ceased ? `<b>Ceased on ${event.data.ceased_on}</b>` : ""}
    <p>${event.resource_kind} at ${new Date(
    event.event.published_at
  ).toLocaleTimeString()}</p>
    </div>`
}

const chargesCard = async (event) => {
  const [, companyNumber] = event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/charges/
  )
  const companyProfile = {}
  // const companyProfile = await fetch(functionUrl + companyNumber)
  //   .then((r) => r.json())
  //   .catch(console.error)
  return `
        <div class="charges-card"><h3>${companyProfile?.name ?? companyNumber}
        <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
        </h3>
        <p>${event.data.classification.description}</p>
        <p>Charge published at ${new Date(
    event.event.published_at
  ).toLocaleTimeString()}</p>
        </div>
      `
}
const insolvencyCard = async (event) => {
  const companyNumber = event.resource_id
  const companyProfile = {}
  // const companyProfile = await fetch(functionUrl + companyNumber)
  //   .then((r) => r.json())
  //   .catch(console.error)
  return `
        <div class="insolvency-card"><h3>Insolvency: ${
    companyProfile?.name ?? companyNumber
  }
        <sub><code><a href="https://filterfacility.co.uk/company/${
    event.resource_id
  }" target="_blank">${event.resource_id}</a></code></sub>
        </h3><p>${event.data.cases[0].type}</p>
        <p>Published at ${new Date(
    event.event.published_at
  ).toLocaleTimeString()}</p>
        </div>
        `
}
