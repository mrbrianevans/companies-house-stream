import { Component, createMemo } from "solid-js"
import type { InsolvencyEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"
import { DeepReadonly } from "solid-js/store"

interface InsolvencyEventCardProps {
  event: DeepReadonly<InsolvencyEvent.InsolvencyEvent>
}

export const InsolvencyEventCard: Component<InsolvencyEventCardProps> = ({ event }) => {
  const companyNumber = event.resource_id
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="insolvency-card">
      <div class="row">
        <h3>{companyNumber}</h3>
        <sub><code><a target="_blank">{companyNumber}</a></code></sub>
      </div>
      <p>{event.data.cases[0].type}</p>
      <p>Insolvency published at {published.toPlainTime().toString()}</p>
    </div>
  </div>
}
