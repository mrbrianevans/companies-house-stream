import { Component, createMemo } from "solid-js"
import type { PscEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"
import { DeepReadonly } from "solid-js/store"

interface PscEventCardProps {
  event: DeepReadonly<PscEvent.PscEvent>
}

export const PscEventCard: Component<PscEventCardProps> = ({ event }) => {
  const companyNumber = createMemo(() => event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\//
  )[1])
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="psc-card">
      <div class="row">
        <h3>{companyNumber()}</h3>
        <sub><code><a target="_blank">{companyNumber()}</a></code></sub>
      </div>
      <p>{event.data.name} notified on {event.data.notified_on}</p>
      {event.data.ceased_on !== undefined ? <b>Resigned on {event.data.ceased_on}</b> : ""}
      <p>{event.resource_kind} published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
