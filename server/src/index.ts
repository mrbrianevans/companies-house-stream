import express from "express";
import { Server } from "http";
import { Server as Socket } from "socket.io";
import * as path from "path";
import { PermPsc } from "./pscStream";
import { PermOfficers } from "./officersStream";

const index = express();
const httpServer = new Server(index);
const io = new Socket(httpServer);
// log each request:
index.use((req, res, next) => {
  console.log("Request to", req.path);
  next();
});
index.use(express.static(path.resolve("..", "client")));

// API endpoints
index.use(express.json());
// index.post("/getCompanyInfo", getCompanyInfoApi)
// index.get("/getCompanyInfo", getCompanyInfoApi)
// index.post("/getFilingDescription", getFilingDescription)
// index.get("/generateGraphData", generateGraphData)

const port = 3000;
httpServer.listen(port, () =>
  console.log(`\x1b[32mListening on http://localhost:${port}\x1b[0m
-----------------------------------------------------\n`)
);

await Promise.all([
  // PermCharges(io),
  // PermCompanies(io),
  // PermFilings(io),
  // PermInsolvencies(io),
  PermOfficers(io),
  PermPsc(io)
]);

