import { Component, createMemo } from "solid-js"
import type { FilingEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"
import { DeepReadonly } from "solid-js/store"

interface FilingEventCardProps {
  event: DeepReadonly<FilingEvent.FilingEvent>
}

export const FilingEventCard: Component<FilingEventCardProps> = ({ event }) => {
  const companyNumber = createMemo(() => event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/filing-history/
  )[1])
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="filing-card">
      <div class="row">
        <h3>{companyNumber()}</h3>
        <sub><code><a target="_blank">{companyNumber()}</a></code></sub>
      </div>
      <p>{event.data.description}</p>
      <p>{event.data.category} published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
