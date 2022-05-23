import { Transform } from "stream"
import { performance } from "perf_hooks"

/**
 * Transform a stream of chunked JSON text into an object mode readable stream of parsed JSON objects.
 */
export class CustomJsonParse extends Transform {
  private data: string
  private readonly addTimestamp: boolean

  constructor(options, addTimestamp: boolean = false) {
    super({
      ...options,
      decodeStrings: false, // stops the strings being converted to buffers
      readableObjectMode: true
    })
    this.data = ""
    this.addTimestamp = addTimestamp
  }

  _transform(chunk: Buffer, encoding, callback) {
    const received = performance.timeOrigin + performance.now() // collect timestamp that event was received
    this.data += chunk.toString("utf8")
    const objects = this.data.split(/\n+/)
    this.data = ""
    for (const obj of objects) {
      if (obj.trim().length === 0) continue
      try {
        const parsedObj = JSON.parse(obj)
        if (typeof parsedObj !== "object") throw new Error("Chunk in stream contained " + typeof parsedObj + " instead of object")
        if (this.addTimestamp) parsedObj.received = received
        this.push(parsedObj)
      } catch (e) {
        if (e instanceof SyntaxError) {
          if (this.data.length > 0) throw new Error("More than one object could not be parsed and are being set to this.data")
          this.data = obj.trim()
        } else throw e
      }
    }
    callback()
  }

  _flush(callback) {
    console.log("Flush called")
    try {
      // Make sure is valid json.
      const parsedJson = JSON.parse(this.data)
      this.push(parsedJson)
      callback()
    } catch (err) {
      callback(err)
    }
  }
}
