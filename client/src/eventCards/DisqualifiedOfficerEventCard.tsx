import { Component } from "solid-js"
import type { DisqualifiedOfficerEvent } from "../types/eventTypes"
import { Temporal } from "temporal-polyfill"
import { DeepReadonly } from "solid-js/store"

interface DisqualifiedOfficerEventCardProps {
  event: DeepReadonly<DisqualifiedOfficerEvent.DisqualifiedOfficerEvent>
}

export const DisqualifiedOfficerEventCard: Component<DisqualifiedOfficerEventCardProps> = ({ event }) => {
  const published = Temporal.PlainDateTime.from(event.event.published_at)
  return <div class={"event"}>
    <div class="disqualified-officer-card">
      <div class="row">
        <h3>{event.data.title} {event.data.forename} {event.data.other_forenames} {event.data.surname}</h3>
      </div>
      <p class={"wrap"}>{event.data.forename} {event.data.surname} disqualified
        from {event.data.disqualifications.at(-1).disqualified_from} {" "}
        until {event.data.disqualifications.at(-1).disqualified_until}.
        Company {event.data.disqualifications.at(-1).company_names.join(", ")}</p>
      {event.data.disqualifications.length > 1 ? <b>More than 1 disqualification for this officer</b> : ""}
      <p class={"wrap"}>Born on {event.data.date_of_birth}. {event.data.nationality} nationality</p>
      <p>{event.data.kind} published at {published.toPlainTime().toLocaleString()}</p>
    </div>
  </div>
}
