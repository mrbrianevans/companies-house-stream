import { Component } from "solid-js"
import "./App.scss"

const App: Component = () => {

  return (
    <>
      <h1>Companies Stream Website</h1>
      <div class={"disconnected"} id={"connection-status"}>
        Disconnected
      </div>
    </>
  )
}

export default App
