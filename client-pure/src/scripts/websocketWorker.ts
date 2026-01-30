import { websocketEmitter } from "./connectToWebsocket";

let emitter;
let connected = false;
self.addEventListener("message", (msg) => {
  switch (msg.data.type) {
    case "url":
      {
        emitter = websocketEmitter(msg.data.url);

        emitter.on("event", (e) => {
          postMessage({ type: "event", data: e });
        });

        emitter.on("connected", () => {
          connected = true;
          postMessage({ type: "connected" });
        });
        emitter.on("disconnected", () => {
          connected = false;
          postMessage({ type: "disconnected" });
        });
      }
      break;
    case "close":
      {
        emitter?.close();
      }
      break;
    case "start":
      {
        emitter?.start();
      }
      break;
    case "status": {
      postMessage({ type: "status", connected });
    }
  }
});
