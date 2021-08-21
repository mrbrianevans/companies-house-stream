import * as request from "request";
import { FilingEvent } from "./types/eventTypes";
import { getMongoClient } from "./getMongoClient";
import { MongoError } from "mongodb";
import * as logger from "node-color-log";
import { getCompanyInfo } from "./getCompanyInfo";

const TARGET_QUEUE_SIZE = 20
const MIN_DELAY = 200 //ms
const MAX_DELAY = 600_000 //ms (10 minutes)
export const StreamFilings = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(async () => {
      io.emit(
        "event",
        sampleFilingEvents[
          Math.floor(Math.random() * sampleFilingEvents.length)
          ]
      );
      StreamFilings(io, "test");
    }, Math.random() * 2000);
  } else {
    let dataBuffer = "";
	const queue = []
    const reqStream = request
      .get("https://stream.companieshouse.gov.uk/filings")
      .auth(process.env.APIUSER, "")
      .on("response", (r: any) => {
        setTimeout(() => {
          console.log("Killing the filing stream after 24 hours");
          reqStream.end();
        }, 1000 * 60 * 60 * 24); // end after 24 hours
        console.log("filing Headers received, status", r.statusCode);
        switch (r.statusCode) {
          case 200:
            console.time("Listening on filing stream");
            console.log("Listening to updates on filing stream");
            break;
          case 416:
            console.log("Timepoint out of date");
            break;
          case 429:
            console.log("RATE LIMITED, exiting now");
            process.exit();
            break;
          default:
            process.exit();
        }
      })
      .on("error", (e: Error) => console.error("Ferror", e))
      .on("data", async (d: any) => {
        if (d.toString().length > 1) {
          reqStream.pause();

          dataBuffer += d.toString("utf8");
          dataBuffer = dataBuffer.replace("}}{", "}}\n{");
          while (dataBuffer.includes("\n")) {
            let newLinePosition = dataBuffer.search("\n");
            let jsonText = dataBuffer.slice(0, newLinePosition);
            dataBuffer = dataBuffer.slice(newLinePosition + 1);
            if (jsonText.length === 0) continue;
            // const client = await dbPool.connect()
            try {
              let jsonObject: FilingEvent.FilingEvent = JSON.parse(jsonText);
              const companyNumber = jsonObject.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/filing-history/)[1];
              // save event in mongo db
              const client = await getMongoClient();
              try {
                await client
                  .db("events")
                  .collection("filing_events")
                  .insertOne({
                    _id: jsonObject.resource_id,
                    ...jsonObject
                  }).then(async () => {
                    // make sure company is in postgres otherwise put in not_found
                    const companyProfile = await getCompanyInfo(companyNumber);
                    // emit event because its not a duplicate
					queue.push({ ...jsonObject, companyProfile })
                  });
              } catch (e) {
                if (e instanceof MongoError && e.code != 11000)
                  logger
                    .color("red")
                    .log("failed to save company-event in mongodb")
                    .log("Message: ", e.message)
                    .log("Name: ", e.name)
                    .log("Code: ", e.code);
              } finally {
                await client.close();
              }

            } catch (e) {
              // error handling
              if (e instanceof SyntaxError)
                console.error(
                  `\x1b[31mCOULD NOT PARSE filing: \x1b[0m*${jsonText}*`
                );
              else console.error("\x1b[31m", e, "\x1b[0m");
            } finally {
              // await client.release() // release the client when finished, regardless of errors
            }

          }
          reqStream.resume();
        } else {
          io.emit("heartbeat", {});
        }
      })
      .on("end", async () => {
        console.timeEnd("Listening on filing stream");
        console.error("Filing stream ended");
      });
	  let releasedCount = 0
	  //console.log(`qtyReleased,queueLength,delay`)
	  setInterval(()=>{
		  //console.log(`${releasedCount},${queue.length},${Math.round(delay)}`)
	  }, 1000)
	  let delay = 1000 // milliseconds between emits
	  // shift the first event in the queue
	  const releaseEvent = () => {
		  // only release an event if there are more than zero queue length
		  if(queue.length > 0) {
			  releasedCount++
			  io.emit('event', queue.shift())
		  }
		  //if the queue is shorter than desired, increase the delay, otherwise decrease it
		  if(queue.length < TARGET_QUEUE_SIZE) delay *= 1.1
		  else if(queue.length > TARGET_QUEUE_SIZE) delay /= 1.1
		  delay = Math.max(Math.round(delay),MIN_DELAY) // prevent going below MIN_DELAY
		  delay = Math.min(Math.round(delay),MAX_DELAY) // prevent going above MAX_DELAY
		  setTimeout(releaseEvent, delay)
	  }
	  releaseEvent()
  }
};

//test types with a real record:
const sampleFilingEvents: FilingEvent.FilingEvent[] = [
  {
    resource_kind: "filing-history",
    resource_uri: "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4",
    resource_id: "MzI4OTQzODc5MGFkaXF6a2N4",
    data: {
      barcode: "X9WQX0NE",
      category: "accounts",
      date: "2021-01-22",
      description: "accounts-with-accounts-type-micro-entity",
      description_values: {
        made_up_date: "2020-03-31"
      },
      links: {
        self: "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4"
      },
      transaction_id: "MzI4OTQzODc5MGFkaXF6a2N4",
      type: "AA"
    },
    event: {
      timepoint: 48990574,
      published_at: "2021-01-22T18:28:02",
      type: "changed"
    }
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4",
    resource_id: "MzI2NTIzNzU0N2FkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21"
          },
          type: "ANNOTATION"
        }
      ],
      barcode: "X95HGATK",
      category: "confirmation-statement",
      date: "2020-05-20",
      description: "confirmation-statement",
      description_values: {
        original_description: "20/05/20 Statement of Capital gbp 126"
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/TsRu1rGfoPfqgDJB2RvUReq1XPkdrjvr302RHkUW_ww",
        self: "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4"
      },
      pages: 5,
      paper_filed: true,
      transaction_id: "MzI2NTIzNzU0N2FkaXF6a2N4",
      type: "CS01"
    },
    event: {
      timepoint: 49098961,
      published_at: "2021-01-25T13:32:01",
      type: "changed"
    }
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4",
    resource_id: "MzI4MDM0NDI4NGFkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21"
          },
          type: "ANNOTATION"
        }
      ],
      barcode: "X9FIEB6B",
      category: "confirmation-statement",
      date: "2020-10-12",
      description: "confirmation-statement",
      description_values: {
        original_description: "21/07/20 Statement of Capital eur 38000001"
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/2IPexI9Xo_VfyzWXITSO4cQ7LvDWwN4U24rNeUlCBHE",
        self: "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4"
      },
      pages: 4,
      paper_filed: true,
      transaction_id: "MzI4MDM0NDI4NGFkaXF6a2N4",
      type: "CS01"
    },
    event: {
      timepoint: 49096881,
      published_at: "2021-01-25T13:16:02",
      type: "changed"
    }
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
    resource_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A second filed CS01  (Statement of capital change and Shareholder information change) was registered on 25/01/2021.",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 (Statement of capital change and Shareholder information change) was registered on 25/01/2021."
          },
          type: "ANNOTATION"
        }
      ],
      barcode: "X9HYDHPL",
      category: "confirmation-statement",
      date: "2020-11-16",
      description: "confirmation-statement",
      description_values: {
        original_description: "14/11/20 Statement of Capital gbp 300.00"
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
        self: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4"
      },
      pages: 5,
      paper_filed: true,
      transaction_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
      type: "CS01"
    },
    event: {
      timepoint: 49095333,
      published_at: "2021-01-25T13:04:04",
      type: "changed"
    }
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
    resource_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
    data: {
      barcode: "X9HYDHPL",
      category: "confirmation-statement",
      date: "2020-11-16",
      description: "confirmation-statement",
      description_values: {
        original_description: "14/11/20 Statement of Capital gbp 300.00"
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
        self: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4"
      },
      pages: 5,
      transaction_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
      type: "CS01"
    },
    event: {
      timepoint: 49094846,
      published_at: "2021-01-25T13:01:04",
      type: "changed"
    }
  }
];
