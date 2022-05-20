import { Component, createMemo } from "solid-js"
import type { CompanyProfileEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"

interface CompanyProfileEventCardProps {
  event: CompanyProfileEvent.CompanyProfileEvent
}

export const CompanyProfileEventCard: Component<CompanyProfileEventCardProps> = ({ event }) => {
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="companies-card">
      <div class="row">
        <h3>{event.data.company_number}</h3>
        <sub><code><a href={`https://filterfacility.co.uk/company/${event.data.company_number}`}
                      target="_blank">{event.data.company_number}</a></code></sub>
      </div>
      <p>Changed {event.event.fields_changed?.join(", ")}</p>
      <p>{event.resource_kind} published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
