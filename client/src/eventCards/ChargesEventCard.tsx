import { Component, createMemo } from "solid-js"
import type { ChargesEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"

interface ChargesEventCardProps {
  event: ChargesEvent.ChargesEvent
}

export const ChargesEventCard: Component<ChargesEventCardProps> = ({ event }) => {
  const companyNumber = createMemo(() => event.resource_uri.match(
    /^\/company\/([A-Z0-9]{6,8})\/charges/
  )[1])
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="charges-card">
      <div class="row">
        <h3>{companyNumber()}</h3>
        <sub><code><a href={`https://filterfacility.co.uk/company/${companyNumber()}`}
                      target="_blank">{companyNumber()}</a></code></sub>
      </div>
      <p>{event.data.classification.description}</p>
      <p>Charge published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
