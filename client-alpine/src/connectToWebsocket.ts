
/**
 * Creates a new websocket connection.
 * Returns an event emitter and close function.
 * Listen to events with websocketEmitter.on('event', e=>handle(e)).
 * Available events that can be emitted are 'connected', 'disconnected', and 'event'
 */
export function websocketEmitter(url: string){
  const emitter = new EventTarget()
  let socket

  function start(){
    socket = new WebSocket(url)
// Connection opened
    socket.addEventListener("open", function(event) {
      emitter.dispatchEvent(new Event("connected"))
    })

    socket.addEventListener("close", function(event) {
      emitter.dispatchEvent(new Event("disconnected"))
    })

// Listen for messages
    socket.addEventListener("message", async function(event) {
      const data = JSON.parse(event.data)
      emitter.dispatchEvent(new CustomEvent("event", { detail: data }))
    })
  }

  return {
      close(){socket?.close()},
      start,
      on(eventName, handler){emitter.addEventListener(eventName, e=>handler((<CustomEvent>e).detail))}
  }
}
