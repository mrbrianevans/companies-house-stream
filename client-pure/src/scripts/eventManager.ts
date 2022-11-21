import '../styles/events.scss'
import { createEventEmitter } from "./workerWrapper"
import { sentenceCase } from "sentence-case"
import { createEventComponent } from "./eventCardFactory"


/* Create a column for each stream */
const eventsContainer = document.getElementById('events')
const containers = {}
const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers"])
for (const streamPath of streamPaths)
{
  const container = document.createElement('div')
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
eventsEmitter.on('event',event => {
  document.getElementById('notification-counter').innerText = (++eventCount).toString()
  // only draw event cards if the document is visible
  if(document.visibilityState === 'visible') {
    const eventCard = createEventComponent(event)
    containers[event.streamPath].insertAdjacentElement('afterbegin', eventCard)
    setTimeout(() => { // remove after 15 seconds
      containers[event.streamPath].removeChild(eventCard)
    }, 15000)
  }
})

eventsEmitter.on('connected', () => {
  document.getElementById('connection-indicator').className = 'connected indicator'
  document.getElementById('connection-button').onclick = ()=>eventsEmitter.close()
  document.getElementById('connection-button').innerText = 'Disconnect'
})
eventsEmitter.on('disconnected', () => {
  document.getElementById('connection-indicator').className = 'disconnected indicator'
  document.getElementById('connection-button').onclick = ()=>eventsEmitter.start()
  document.getElementById('connection-button').innerText = 'Connect'
})

// start the first connection
document.getElementById('connection-button').onclick = () => eventsEmitter.start()
eventsEmitter.start()
