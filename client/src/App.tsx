import { Component, onCleanup } from "solid-js"
import "./styles/column_layout.scss"

const App: Component = () => {
  const socket = new WebSocket(`ws://${window.location.host}/events`)

  socket.addEventListener("message", async function(event) {
    const data = JSON.parse(event.data)
    console.log(data) // todo: create event component
  })
  onCleanup(() => {
    socket.close()
  })
  return (
    <>
      <header>
        <h1>Stream data from companies house in realtime</h1>
        <div class="view-source"><code><a href="https://github.com/mrbrianevans/companies-house-stream"
                                          target="_blank">View source code</a></code>
        </div>
        <div class="row">
          <button class="disconnected" id="connection-status">Disconnected</button>
          <div id="clock-container">
            <div id="clock" class="bubble"></div>
          </div>
          <div id="counter-container">
            <div class="bubble">Notifications: <span id="notification-counter">0</span></div>
          </div>
        </div>
      </header>

      <div id="events">
        <div id="companies"><h3>Company events</h3></div>
        <div id="filings"><h3>Filing events</h3></div>
        <div id="officers"><h3>Officer events</h3></div>
        <div id="psc"><h3>PSC events</h3></div>
        <div id="charges"><h3>Charge events</h3></div>
        <div id="insolvencies"><h3>Insolvency events</h3></div>
      </div>
    </>
  )
}

export default App
