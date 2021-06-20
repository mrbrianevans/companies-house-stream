import { StreamCompanies } from "./companiesStream";
import { StreamCharges } from "./chargesStream";
import { StreamFilings } from "./filingStream";
import { StreamInsolvencies } from "./insolvencyStream";
import { getCompanyInfo } from "./getCompanyInfo";
import { getFilingDescription } from "./getFilingDescription";
import { generateGraphData } from "./getEventsGraph";

const express = require("express");
const index = express();
const httpServer = require("http").Server(index);
const io = require("socket.io")(httpServer);
const path = require("path");
// log each request:
index.use((req, res, next) => {
  console.log("Request to", req.path);
  // console.log('params:', req.params)
  // console.log('body:', req.body)
  // console.log('query:', req.query)
  next();
});

index.use(express.static(path.join(__dirname, "../..", "client")));

if (!process.env.PGPASSWORD) process.env.PGPASSWORD = "postgres";
// these are API endpoints
index.use(express.json());
index.post("/getCompanyInfo", getCompanyInfo);
index.get("/getCompanyInfo", getCompanyInfo);
index.post("/getFilingDescription", getFilingDescription);
index.get("/generateGraphData", generateGraphData);
const port = 3000;
httpServer.listen(port, () =>
  console.log(
`\x1b[32mListening on http://localhost:${port}\x1b[0m
Graph on http://localhost:${port}/graph

MONGO_CACHING: ${Number(process.env.MONGO_CACHING) === 1 ? "ENABLED" : "DISABLED"}
REDIS_CACHING: ${Number(process.env.REDIS_CACHING) === 1 ? "ENABLED" : "DISABLED"}
`
  )
);

// StreamCompanies(io, "test")
// StreamCharges(io, "test")
// StreamFilings(io, "test")
// StreamInsolvencies(io, "test")

StreamCompanies(io, "live");
StreamCharges(io, "live");
StreamFilings(io, "live");
StreamInsolvencies(io, "live");

setInterval(() => {
  console.log("Starting all streams (24th hour interval)");
  StreamCompanies(io, "live");
  StreamCharges(io, "live");
  StreamFilings(io, "live");
  StreamInsolvencies(io, "live");
  // reset the stream every 24 hours 150 milliseconds
}, 1000 * 60 * 60 * 24 + 150);
