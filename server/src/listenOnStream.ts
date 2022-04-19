import { request } from "https";
import type { RequestOptions } from "https";
import type { CompanyProfileEvent } from "./types/eventTypes";
import JSONStream = require("JSONStream");

//Streaming API key
const streamingApiKey = process.env.STREAMING_KEY;

/**
 * Listens to a HTTPS stream of events from companies house on `path`, and calls `callback` with each one.
 * @param path - URL path to listen on. Defaults to `companies`. Can be `filings` or `persons-with-significant-control` etc.
 * @param callback - function to call on each event. Will call with the event data as the only parameter.
 * @param startFromTimepoint - timepoint to start from. If omitted, then will start from the latest event.
 */
export function listenToStream<EventType extends { resource_id: string } = CompanyProfileEvent.CompanyProfileEvent>(path = "companies", callback: (e: EventType) => void = console.log, startFromTimepoint?: number) {
  if (!streamingApiKey) return console.error("API key environment variable not set");
  const timepointQueryString = (typeof startFromTimepoint === "number") ? `?timepoint=${startFromTimepoint}` : "";
  const options: RequestOptions = {
    hostname: "stream.companieshouse.gov.uk",
    port: 443,
    path: "/" + path + timepointQueryString,
    method: "GET",
    auth: streamingApiKey + ":"
  };

  const handleError = (e: Error) => console.error(`Error on ${path} stream`, "\x1b[31m", e.message, "\x1b[0m");
  console.time("Request");
  request(options, res => {
    console.timeEnd("Request");
    console.log(path, "responded with STATUS", res.statusCode, res.statusMessage);
    res.on("data", b => console.log("response body", b.toString()));
    res.pipe(JSONStream.parse())
      .on("data", callback)
      .on("error", handleError);
  }).on("error", handleError).end();
}

