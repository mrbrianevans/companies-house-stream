import { Component, createMemo } from "solid-js"
import type { OfficerEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"

interface OfficerEventCardProps {
  event: OfficerEvent.OfficerEvent
}

export const OfficerEventCard: Component<OfficerEventCardProps> = ({ event }) => {
  const companyNumber = createMemo(() => event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\//
  )[1])
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="officer-card">
      <div class="row">
        <h3>{companyNumber()}</h3>
        <sub><code><a target="_blank">{companyNumber()}</a></code></sub>
      </div>
      <p>{event.data.name} appointed {event.data.officer_role} on {
        event.data.appointed_on
      }</p>
      {event.data.resigned_on !== undefined ? <b>Resigned on {event.data.resigned_on}</b> : ""}
      <p>{event.resource_kind} published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
