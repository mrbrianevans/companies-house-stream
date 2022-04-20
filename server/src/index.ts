import express from "express";
import { createServer, Server } from "http";
import * as path from "path";
import { PermPsc } from "./streams/pscStream";
import { PermOfficers } from "./streams/officersStream";
import { getCompanyInfoApi } from "./endpointHandlers/getCompanyInfo";
import { getFilingDescription } from "./endpointHandlers/getFilingDescription";
import { generateGraphData } from "./endpointHandlers/getEventsGraph";
import { WebSocketServer, createWebSocketStream } from "ws";
import { parse } from "url";
import { stream, streamGenerator } from "./streams/listenOnStream";
import { pipeline } from "stream";

const index = express();
// const httpServer = new Server(index);

// const io = new Socket(httpServer);
// log each request:
index.use((req, res, next) => {
  console.log("Request to", req.path);
  next();
});
index.use(express.static(path.resolve("..", "client")));

// API endpoints
index.use(express.json());
index.post("/getCompanyInfo", getCompanyInfoApi);
index.get("/getCompanyInfo", getCompanyInfoApi);
index.post("/getFilingDescription", getFilingDescription);
index.get("/generateGraphData", generateGraphData);

const port = 3000;
const server = index.listen(port, () =>
  console.log(`\x1b[32mListening on http://localhost:${port}\x1b[0m
-----------------------------------------------------\n`)
);
const inputStream = stream("companies");

// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", function connection(ws, req) {
  const eventStream = createWebSocketStream(ws);
  // @ts-ignore typescript doesn't have the latest stream methods
  inputStream.map(e => {
    console.log("Event at ", new Date());
    return JSON.stringify(e);
  }).pipe(eventStream);
  //todo: need to stop piping events when websocket closes
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


await Promise.all([
  // PermCharges(io),
  // PermCompanies(io),
  // PermFilings(io),
  // PermInsolvencies(io),
  // PermOfficers(io),
  // PermPsc(io),
]);
