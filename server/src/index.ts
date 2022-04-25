import "dotenv/config";
import express from "express";
import * as path from "path"
import { getCompanyInfoApi } from "./endpointHandlers/getCompanyInfo"
import { getFilingDescription } from "./endpointHandlers/getFilingDescription"
import { generateGraphData } from "./endpointHandlers/getEventsGraph"
import { WebSocketServer } from "ws"
import { parse } from "url"
import { stream } from "./streams/listenOnStream"
import { restKeyHolder, streamKeyHolder } from "./utils/KeyHolder"

const index = express()
streamKeyHolder.addKey(process.env.STREAM_KEY1)
streamKeyHolder.addKey(process.env.STREAM_KEY2)
streamKeyHolder.addKey(process.env.STREAM_KEY3)
restKeyHolder.addKey(process.env.REST_KEY1)
// log each request:
index.use((req, res, next) => {
  console.log("Request to", req.path)
  next()
})
index.use(express.static(path.resolve("..", "client")))

// API endpoints
// @ts-ignore
index.use(express.json())
index.post("/getCompanyInfo", getCompanyInfoApi);
index.get("/getCompanyInfo", getCompanyInfoApi);
index.post("/getFilingDescription", getFilingDescription);
index.get("/generateGraphData", generateGraphData);

const port = 3000;
const server = index.listen(port, () =>
  console.log(`\x1b[32mListening on http://localhost:${port}\x1b[0m
-----------------------------------------------------\n`)
);
//todo: these need to be replaced with permanent stream that will reconnect if they get disconnected
const companyStream = stream("companies");
const filingStream = stream("filings");
const officerStream = stream("officers");
const pscStream = stream("persons-with-significant-control");
const chargeStream = stream("charges");
const insolvencyStream = stream("insolvency-cases");

// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", function connection(ws, req) {
  const sendEvent = event => ws.send(JSON.stringify(event));
  companyStream.addListener("data", sendEvent);
  filingStream.addListener("data", sendEvent);
  officerStream.addListener("data", sendEvent);
  pscStream.addListener("data", sendEvent);
  chargeStream.addListener("data", sendEvent);
  insolvencyStream.addListener("data", sendEvent);
  ws.on("close", () => {
    companyStream.removeListener("data", sendEvent);
    filingStream.removeListener("data", sendEvent);
    officerStream.removeListener("data", sendEvent);
    pscStream.removeListener("data", sendEvent);
    chargeStream.removeListener("data", sendEvent);
    insolvencyStream.removeListener("data", sendEvent);
  });
});


// handles websocket on /events path of server
server.on("upgrade", function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);

  if (pathname === "/events") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request);
    });

  } else {
    socket.destroy();
  }
});
