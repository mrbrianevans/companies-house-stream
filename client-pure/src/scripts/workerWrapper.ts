// this should be called from the main thread. it starts a worker and emits the events


export function createEventEmitter() {
  const eventsEmitter = new EventTarget()
  const worker = new Worker(new URL("./websocketWorker.ts", import.meta.url), {
    type: "module"
  })
  const { host, protocol } = window.location
  const wsProtocol = protocol === "http:" ? "ws" : "wss"
  const url = `${wsProtocol}://${host}/events`
  worker.postMessage({ type: "url", url })
  worker.addEventListener("message", m => eventsEmitter.dispatchEvent(new CustomEvent(m.data.type, { detail: m.data.data })))
  return {
    close() {
      worker.postMessage({ type: "close" })
    },
    start() {
      worker.postMessage({ type: "start" })
    },
    on(eventName, handler) {
      eventsEmitter.addEventListener(eventName, e => handler((<CustomEvent>e).detail))
    },
    triggerStatus() {
      worker.postMessage({ type: "status" })
    }
  }
}
