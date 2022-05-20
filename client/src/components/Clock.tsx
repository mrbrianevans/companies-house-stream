import { Component, createSignal } from "solid-js"
import { Temporal } from "temporal-polyfill"

const getTime = () => Temporal.Now.plainTimeISO().toString({ fractionalSecondDigits: 0 })

export const Clock: Component = () => {
  const [time, setTime] = createSignal(getTime())
  setInterval(() => setTime(getTime()), 1000)
  return <div id="clock-container">
    <div id="clock" class="bubble">{time()}</div>
  </div>
}
