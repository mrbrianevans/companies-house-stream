import { Component, createSignal, For, onCleanup } from "solid-js"
import "./styles/column_layout.scss"
import { Clock } from "./components/Clock"
import { createStore } from "solid-js/store"
import { FilingEventCard } from "./eventCards/FilingEventCard"
import type { AnyEvent } from "./types/eventTypes"
import { CompanyProfileEventCard } from "./eventCards/CompanyProfileEventCard"
import { OfficerEventCard } from "./eventCards/OfficerEventCard"
import { PscEventCard } from "./eventCards/PscEventCard"
import { ChargesEventCard } from "./eventCards/ChargesEventCard"
import { InsolvencyEventCard } from "./eventCards/InsolvencyEventCard"
import { ConnectedIcon } from "./components/ConnectedIcon"

interface Health {
  "companies": boolean,
  "filings": boolean,
  "officers": boolean,
  "persons-with-significant-control": boolean,
  "charges": boolean,
  "insolvency-cases": boolean
}

const App: Component = () => {
  const [connected, setConnected] = createSignal(false)
  const [count, setCount] = createSignal(0)
  const [online, setOnline] = createSignal(true)
  addEventListener("online", () => setOnline(true))
  addEventListener("offline", () => setOnline(false))
  const [events, setEvents] = createStore<AnyEvent[]>([])
  setInterval(() => setEvents(e => e.slice(0, 100)), 15000)
  const [health, setHealth] = createSignal<Health>()
  setInterval(() => {
    fetch("/events/health").then(r => r.json()).then(setHealth).catch()
  }, 30_000)
  fetch("/events/health").then(r => r.json()).then(setHealth).catch()

  function openSocket() {
    const socket = new WebSocket(`wss://${window.location.host}/events`)
// Connection opened
    socket.addEventListener("open", function(event) {
      setConnected(true)
    })

    socket.addEventListener("close", function(event) {
      setConnected(false)
    })

// Listen for messages
    socket.addEventListener("message", async function(event) {
      setCount(prev => ++prev)
      const data: AnyEvent = JSON.parse(event.data)
      setEvents(e => [data, ...e])
      setTimeout(() => {
        //remove event from events store after 15 seconds
        setEvents(ev => ev.filter(e => e?.resource_id !== data.resource_id))
      }, 15000)
    })
    return () => socket.close()
  }

  let socket = openSocket()
  onCleanup(() => {
    socket()
  })
  return (
    <>
      <header>
        <h1>Stream data from companies house in realtime <ConnectedIcon connected={online()} /></h1>
        <div class="view-source"><code><a href="https://github.com/mrbrianevans/companies-house-stream"
                                          target="_blank">View source code</a></code>
        </div>
        <div class="row">
          <button class={connected() ? "connected" : "disconnected"} id="connection-status"
                  onClick={() => connected() ? socket() : socket = openSocket()}>{connected() ? "Connected" : "Disconnected"}</button>
          <Clock />
          <div id="counter-container">
            <div class="bubble">Event count: <span id="notification-counter">{count()}</span></div>
          </div>
        </div>
      </header>
      {/*<div>Events on screen: {events.length}</div>*/}
      <pre>{JSON.stringify(health, null, 2)}</pre>
      <div id="events">
        <div><h3>Company events <ConnectedIcon connected={health()?.companies ?? false} /></h3><For
          each={events.filter(e => e?.resource_kind === "company-profile")}>{event => event.resource_kind === "company-profile" ?
          <CompanyProfileEventCard event={event} /> : ""}</For></div>
        <div><h3>Filing events <ConnectedIcon connected={health()?.filings ?? false} /></h3><For
          each={events.filter(e => e?.resource_kind === "filing-history")}>{event => event.resource_kind === "filing-history" ?
          <FilingEventCard event={event} /> : ""}</For></div>
        <div><h3>Officer events <ConnectedIcon connected={health()?.officers ?? false} /></h3><For
          each={events.filter(e => e?.resource_kind === "company-officers")}>{event => event.resource_kind === "company-officers" ?
          <OfficerEventCard event={event} /> : ""}</For></div>
        <div><h3>PSC events <ConnectedIcon connected={health()?.["persons-with-significant-control"] ?? false} /></h3>
          <For
            each={events.filter(e => e?.resource_kind.startsWith("company-psc"))}>{event => event.resource_kind === "company-psc-corporate" || event.resource_kind === "company-psc-individual" ?
            <PscEventCard event={event} /> : ""}</For></div>
        <div><h3>Charge events <ConnectedIcon connected={health()?.charges ?? false} /></h3><For
          each={events.filter(e => e?.resource_kind === "company-charges")}>{event => event.resource_kind === "company-charges" ?
          <ChargesEventCard event={event} /> : ""}</For></div>
        <div><h3>Insolvency events <ConnectedIcon connected={health()?.["insolvency-cases"] ?? false} /></h3><For
          each={events.filter(e => e?.resource_kind === "company-insolvency")}>{event => event.resource_kind === "company-insolvency" ?
          <InsolvencyEventCard event={event} /> : ""}</For></div>
        <div><h3>Disqualified officers <ConnectedIcon connected={health()?.["disqualified-officers"] ?? false} /></h3>
          {/*<For*/}
          {/*each={events.filter(e => e?.resource_kind === "disqualified-officer")}>{event => event.resource_kind === "disqualified-officer" ?*/}
          {/*<DisqualifiedOfficerEventCard event={event} /> : ""}</For>*/}
        </div>
      </div>
    </>
  )
}

export default App
