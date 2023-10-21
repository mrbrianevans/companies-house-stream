import "../styles/events.scss"
import { createEventEmitter } from "./workerWrapper"
import { sentenceCase } from "change-case"
import { createEventComponent, getDescription } from "./eventCardFactory"
import { streamPaths } from "./streamPaths"

let filter = ""
const filterTextBox = document.getElementById("filter-text") as HTMLInputElement
filterTextBox?.addEventListener("keyup", e => {
  // if(filterTextBox?.value.length === 8) // must be 8 character company number
  filter = filterTextBox?.value ?? ""
  // else filter = ''
})

/* Create a column for each stream */
const eventsContainer = document.getElementById("events")
const containers = {}
for (const streamPath of streamPaths) {
  //TODO: add an option for the user to combine some columns: [officers, disqualified officers] [psc, psc statements, exemptions]
  const container = document.createElement("div")
  container.id = `${streamPath}-container`
  container.className = "event-column"
  container.innerHTML = `
  <div class="stream-title">
    <h2>${sentenceCase(streamPath)} 
      <span class="upstream-status indicator" id="${streamPath}-upstream" aria-label="${sentenceCase(streamPath)} upstream status" role="status"></span>
    </h2>
    <span id="delay-${streamPath}" class="delay"></span>
    <code>/${streamPath}</code>
  </div>
  <div class="events-container"></div>`
  eventsContainer.appendChild(container)
  containers[streamPath] = container.lastElementChild
}


/* Get events from web worker that listens to websocket */
let eventCount = 0
const eventsEmitter = createEventEmitter()
eventsEmitter.on("event", event => {
  document.getElementById("notification-counter").innerText = (++eventCount).toString()
  const { companyNumber } = getDescription(event)
  // add events if browser is not visible only if the filter is set to a company number
  if (document.visibilityState === "visible" || filter.length === 8) {
    if (companyNumber.includes(filter)) {
      const eventCard = createEventComponent(event)
      containers[event.streamPath].insertAdjacentElement("afterbegin", eventCard)
      const timeout = (filter.length + 0.5) * 30_000
      setTimeout(() => {
        // remove after some time depending on how specific the filter is
        containers[event.streamPath].removeChild(eventCard)
      }, timeout)
    }
  }
})

eventsEmitter.on("connected", () => {
  document.getElementById("connection-indicator").className = "connected indicator"
  document.getElementById("connection-button").onclick = () => eventsEmitter.close()
  document.getElementById("connection-button").innerText = "Disconnect"
})
eventsEmitter.on("disconnected", () => {
  document.getElementById("connection-indicator").className = "disconnected indicator"
  document.getElementById("connection-button").onclick = () => eventsEmitter.start()
  document.getElementById("connection-button").innerText = "Connect"
})

// start the first connection
document.getElementById("connection-button").onclick = () => eventsEmitter.start()
eventsEmitter.start()
