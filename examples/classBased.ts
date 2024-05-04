// goals:
// - must return response to caller, not simply print it. This is to allow saving it to redis and deleting old timepoints
// - must emit events in an easy-to-use manner for multiple streams concurrently (shouldn't be an async iterator)
// - use split2 to separate events
// - needs an ergonomic way of indicating a disconnect to allow easy reconnect
// - a class might actually work quite nicely?!
// - must emit heartbeat events


import { EventEmitter } from "events"
import { get } from "node:https"
import type { RequestOptions } from "node:https"
import { IncomingMessage } from "http"
import split2 from "split2"
import { Transform } from "stream"

const getPromise = (options: RequestOptions) => new Promise<IncomingMessage>(resolve => get(options, resolve))

// this approach has not been tested overnight to see if it reconnects after the midnight disconnect from companies house

class ChStream extends EventEmitter {

  connected: boolean
  streamPath: string
  parseStream: Transform


  constructor(streamPath: string) {
    super()
    this.streamPath = streamPath
    this.parseStream = split2(JSON.parse)
    this.parseStream.on("data", (data) => this.emit("event", data))
    this.parseStream.on("error", (error) => console.log(new Date(), "Parse stream error", error))
  }

  // can be called the first time to connect, as well as to reconnect when disconnected
  async connect(startFromTimepoint?: number) {
    if (this.connected) throw new Error("Already connected")
    // this method will return the http response (eg headers and status code)
    // but emit events on the class when they arrive
    const auth = process.env.STREAM_KEY1 + ":"
    const path = "/" + this.streamPath + (typeof startFromTimepoint === "number" ? `?timepoint=${startFromTimepoint}` : "")
    const options: RequestOptions = { hostname: "stream.companieshouse.gov.uk", path, auth }
    const res = await getPromise(options)
    // pipe res to split2 and then emit events
    if (res.statusCode === 200) {
      this.connected = true
      this.emit("connected")
      res.on("data", () => this.emit("heartbeat")).pipe(this.parseStream, { end: false })
      // assuming 'end' is the right event to listen on. What's the difference between this and close?
      res.on("end", () => {
        res.unpipe(this.parseStream)
        console.log(new Date(), "ended")
        this.connected = false
        this.emit("disconnected")
      })
      res.on("close", () => {
        res.unpipe(this.parseStream)
        console.log(new Date(), "closed")
        this.connected = false
        this.emit("disconnected")
      })
    }
    return { statusCode: res.statusCode }
  }
}

const testStream = new ChStream("officers")
// testStream.on("event", (d) => console.log("event emitted", d))
testStream.on("heartbeat", () => console.log(new Date(), "heartbeat emitted"))
const { statusCode } = await testStream.connect()
console.log(new Date(), "Received response", { statusCode })
testStream.on("disconnected", () => {
  console.log(new Date(), "Disconnected from stream. Reconnecting")
  testStream.connect()
})
testStream.on("connected", () => console.log(new Date(), "Connected to stream"))
