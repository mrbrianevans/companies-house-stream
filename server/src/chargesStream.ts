import * as request from "request";
import { ChargesEvent } from "./types/eventTypes";
import { promisify } from "util";
import { getMongoClient } from "./getMongoClient";
import { MongoError } from "mongodb";
import * as logger from "node-color-log";
import { getCompanyInfo } from "./getCompanyInfo";

let mostRecentWaitTime = 0;
const wait = promisify((s, c) => {
  mostRecentWaitTime = s;
  if (!isFinite(s)) s = 300;
  if (s > 5000) s = 5000;
  setTimeout(() => c(null, "done waiting"), s);
});
let qtyOfNotifications = 0;
let averageProcessingTime = 0;
let startTime = Date.now();
let reportStatsInterval;
let resetStatsInterval;
let last60NotificationTimes = [];
let last60ProcessingTimes = [];
let last60Backlog = [];

export const StreamCharges = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(async () => {
      io.emit(
        "event",
        sampleChargeEvents[
          Math.floor(Math.random() * sampleChargeEvents.length)
          ]
      );
      StreamCharges(io, "test");
    }, Math.random() * 10000);
  } else {
    let dataBuffer = "";
    const reqStream = request
      .get("https://stream.companieshouse.gov.uk/charges")
      .auth(process.env.APIUSER, "")
      .on("response", (r: any) => {
        console.log("charges Headers received, status", r.statusCode);
        startTime = Date.now();
        setTimeout(() => {
          console.log("Killing the filing stream after 24 hours");
          reqStream.end();
        }, 1000 * 60 * 60 * 24); // end after 24 hours
        switch (r.statusCode) {
          case 200:
            console.log("Listening to updates on charges stream");
            reportStatsInterval = setInterval(() => {
              const averageBacklog =
                last60Backlog.reduce(
                  (previousValue, currentValue) => previousValue + currentValue,
                  0
                ) /
                last60Backlog.length /
                1000;
              console.log(
                "CHARGES: Average backlog on charges: ",
                Math.round(averageBacklog),
                "seconds"
              );
            }, 1050000);
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
      .on("error", (e: any) => console.error("error", e))
      .on("data", async (d: any) => {
        if (d.toString().length > 1) {
          reqStream.pause();

          dataBuffer += d.toString("utf8");
          dataBuffer = dataBuffer.replace("}}{", "}}\n{");
          while (dataBuffer.includes("\n")) {
            let singleStartTime = Date.now();
            last60NotificationTimes.unshift(Date.now());
            if (qtyOfNotifications > 100) last60NotificationTimes.pop();
            let newLinePosition = dataBuffer.search("\n");
            let jsonText = dataBuffer.slice(0, newLinePosition);
            dataBuffer = dataBuffer.slice(newLinePosition + 1);
            if (jsonText.length === 0) continue;
            try {
              let jsonObject: ChargesEvent.ChargesEvent = JSON.parse(jsonText);
              last60Backlog.unshift(
                Date.now() - new Date(jsonObject.event.published_at).valueOf()
              );

              //work out rolling average of receival time using notifications and processing timing arrays
              if (qtyOfNotifications > 5) {
                const last60TotalTime =
                  last60NotificationTimes[0] -
                  last60NotificationTimes[last60NotificationTimes.length - 1];
                const last60ProcessingTime = last60ProcessingTimes
                  .slice(0, 5)
                  .reduce(
                    (previousValue, currentValue) =>
                      previousValue + currentValue,
                    0
                  );
                const recentProcessingTimePerNotification =
                  last60ProcessingTime /
                  last60ProcessingTimes.slice(0, 5).length;
                const averageTimePerNewNotification =
                  last60TotalTime / (last60NotificationTimes.length + 1);
                const averageBacklog =
                  last60Backlog.reduce(
                    (previousValue, currentValue) =>
                      previousValue + currentValue,
                    0
                  ) /
                  last60Backlog.length /
                  1000;
                // console.log(last60TotalTime,last60ProcessingTime,recentProcessingTimePerNotification,averageTimePerNewNotification,averageBacklog)
                last60Backlog.pop();
                // if average processing time is less than 70% of the frequency of new notifications
                if (
                  (recentProcessingTimePerNotification /
                    averageTimePerNewNotification) *
                  100 <
                  70 &&
                  averageBacklog < 60 * 10
                )
                  await wait(
                    averageTimePerNewNotification -
                    (Date.now() - singleStartTime)
                  );
                else if (
                  (recentProcessingTimePerNotification /
                    averageTimePerNewNotification) *
                  100 <
                  100 &&
                  averageBacklog < 60 * 10
                )
                  // kill switch to never exceed 100%
                  await wait(
                    (averageTimePerNewNotification -
                      (Date.now() - singleStartTime)) *
                    0.5
                  );
              }
              const companyNumber = jsonObject.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/charges/)[1];
              // save event in mongo db
              const client = await getMongoClient();
              try {
                await client
                  .db("events")
                  .collection("charges_events")
                  .insertOne({
                    _id: jsonObject.resource_id,
                    ...jsonObject
                  }).then(async () => {
                    // make sure company is in postgres otherwise put in not_found
                    const companyProfile = await getCompanyInfo(companyNumber);
                    // emit event because its not a duplicate
                    io.emit("event", { ...jsonObject, companyProfile });
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
              // console.log("CHARGES EVENT!!")
              // console.log(JSON.stringify(jsonObject))
            } catch (e) {
              console.error(
                `\x1b[31mCOULD NOT PARSE charges: \x1b[0m*${jsonText}*`
              );
            }
            let totalTimeSoFar =
              qtyOfNotifications++ * averageProcessingTime +
              (Date.now() - singleStartTime);
            averageProcessingTime = totalTimeSoFar / qtyOfNotifications;
            last60ProcessingTimes.unshift(Date.now() - singleStartTime);
            if (qtyOfNotifications > 50) last60ProcessingTimes.pop();
          }
          reqStream.resume();
        } else {
          io.emit("heartbeat", {});
        }
      })
      .on("end", () => {
        clearInterval(reportStatsInterval);
        console.error("Charges stream ended");
      });
  }
};

const sampleChargeEvents: ChargesEvent.ChargesEvent[] = [
  {
    resource_kind: "company-charges",
    resource_uri: "/company/02727406/charges/DEt-R7G3qsFlUqHS5Di_ssulRfk",
    resource_id: "DEt-R7G3qsFlUqHS5Di_ssulRfk",
    data: {
      charge_code: "027274060003",
      charge_number: 3,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2018-07-20",
      delivered_on: "2018-08-02",
      etag: "0d2bd160895f2e3e4708a9119a707f831c9c683c",
      links: { self: "/company/02727406/charges/DEt-R7G3qsFlUqHS5Di_ssulRfk" },
      particulars: {
        contains_fixed_charge: true,
        contains_floating_charge: true,
        contains_negative_pledge: true,
        description: "None.",
        floating_charge_covers_all: true,
        type: "brief-description"
      },
      persons_entitled: [{ name: "Lloyds Bank PLC" }],
      satisfied_on: "2021-01-25",
      status: "fully-satisfied",
      transactions: [
        {
          delivered_on: "2018-08-02",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/02727406/filing-history/MzIxMTI1MDI2MWFkaXF6a2N4"
          }
        },
        {
          delivered_on: "2021-01-25",
          filing_type: "charge-satisfaction",
          links: {
            filing: "/company/02727406/filing-history/MzI4OTU0NTI0M2FkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632970,
      published_at: "2021-01-25T12:22:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/03113932/charges/96EUsQIsqtd6Q0gRXjpchmZm1Hg",
    resource_id: "96EUsQIsqtd6Q0gRXjpchmZm1Hg",
    data: {
      charge_code: "031139320003",
      charge_number: 3,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-13",
      delivered_on: "2021-01-22",
      etag: "f39dc0251d230de27899210444bc816d0016a6e1",
      links: { self: "/company/03113932/charges/96EUsQIsqtd6Q0gRXjpchmZm1Hg" },
      particulars: {
        contains_fixed_charge: true,
        contains_floating_charge: true,
        contains_negative_pledge: true,
        floating_charge_covers_all: true
      },
      persons_entitled: [{ name: "National Westminster Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/03113932/filing-history/MzI4OTQxMzY1MWFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632972,
      published_at: "2021-01-25T12:23:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/08032632/charges/UtdmIOab4ZX_0Qkyl2mfowAGk7A",
    resource_id: "UtdmIOab4ZX_0Qkyl2mfowAGk7A",
    data: {
      charge_code: "080326320028",
      charge_number: 28,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-05",
      delivered_on: "2021-01-22",
      etag: "6b7e0477a4bcc3eacca312667fdbac8dd328f4e6",
      links: { self: "/company/08032632/charges/UtdmIOab4ZX_0Qkyl2mfowAGk7A" },
      particulars: {
        contains_floating_charge: true,
        contains_negative_pledge: true,
        description: "51 - 57 may road, brighton BN2 3ED.",
        type: "brief-description"
      },
      persons_entitled: [{ name: "Robert Charles Grice" }],
      satisfied_on: "2021-01-25",
      status: "fully-satisfied",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/08032632/filing-history/MzI4OTQyODgzN2FkaXF6a2N4"
          }
        },
        {
          delivered_on: "2021-01-25",
          filing_type: "charge-satisfaction",
          links: {
            filing: "/company/08032632/filing-history/MzI4OTU0NTIxOGFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632963,
      published_at: "2021-01-25T12:22:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/03995149/charges/ldhWm4RaAHbooSmmfa76OhJDDK8",
    resource_id: "ldhWm4RaAHbooSmmfa76OhJDDK8",
    data: {
      charge_code: "039951490001",
      charge_number: 1,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-15",
      delivered_on: "2021-01-22",
      etag: "d1e9305c123af910fe61e42e49da3608bec1c631",
      links: { self: "/company/03995149/charges/ldhWm4RaAHbooSmmfa76OhJDDK8" },
      particulars: {
        contains_fixed_charge: true,
        contains_floating_charge: true,
        contains_negative_pledge: true,
        floating_charge_covers_all: true
      },
      persons_entitled: [{ name: "National Westminster Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/03995149/filing-history/MzI4OTQwNzk3MmFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632974,
      published_at: "2021-01-25T12:24:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/11150706/charges/Gt0jfELsAXrqcVQeivfyJSUkhKk",
    resource_id: "Gt0jfELsAXrqcVQeivfyJSUkhKk",
    data: {
      charge_code: "111507060002",
      charge_number: 2,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-11",
      delivered_on: "2021-01-22",
      etag: "02aae307fc66e2150bd121d72813aef93cae7d88",
      links: { self: "/company/11150706/charges/Gt0jfELsAXrqcVQeivfyJSUkhKk" },
      particulars: {
        contains_negative_pledge: true,
        description:
          "All that leasehold property known as 55 great central, chatham street, sheffield, S3 8FG.",
        type: "brief-description"
      },
      persons_entitled: [{ name: "Paratus Amc Limited" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/11150706/filing-history/MzI4OTQyNTMxNmFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632980,
      published_at: "2021-01-25T12:25:02",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/12284440/charges/uU6Af_8M6KYHHWJWxtMR_YQyhS8",
    resource_id: "uU6Af_8M6KYHHWJWxtMR_YQyhS8",
    data: {
      charge_code: "122844400001",
      charge_number: 1,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-20",
      delivered_on: "2021-01-22",
      etag: "a6af4697553ff557593f23b7198ea0c7567b50c7",
      links: { self: "/company/12284440/charges/uU6Af_8M6KYHHWJWxtMR_YQyhS8" },
      particulars: {
        contains_negative_pledge: true,
        description: "65 plassey street penarth CF64 1EP.",
        type: "brief-description"
      },
      persons_entitled: [{ name: "Paragon Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/12284440/filing-history/MzI4OTQzMjM3OWFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632986,
      published_at: "2021-01-25T12:26:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/11972998/charges/l475JIpR_UgMsDts-FZWSDijSng",
    resource_id: "l475JIpR_UgMsDts-FZWSDijSng",
    data: {
      charge_code: "119729980001",
      charge_number: 1,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-20",
      delivered_on: "2021-01-22",
      etag: "4f873789c7acd9cc9182dc2eab269fe456a2c16a",
      links: { self: "/company/11972998/charges/l475JIpR_UgMsDts-FZWSDijSng" },
      particulars: {
        contains_fixed_charge: true,
        contains_floating_charge: true,
        contains_negative_pledge: true,
        description: "None.",
        floating_charge_covers_all: true,
        type: "brief-description"
      },
      persons_entitled: [{ name: "Lloyds Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/11972998/filing-history/MzI4OTQwNDc4MGFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632984,
      published_at: "2021-01-25T12:26:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/12005578/charges/OqHEe_qqdx-EdbgKAKsgRRtbA2s",
    resource_id: "OqHEe_qqdx-EdbgKAKsgRRtbA2s",
    data: {
      charge_code: "120055780002",
      charge_number: 2,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-22",
      delivered_on: "2021-01-22",
      etag: "b7469fca61af9ea3f29de15eef6e676b26df61c7",
      links: { self: "/company/12005578/charges/OqHEe_qqdx-EdbgKAKsgRRtbA2s" },
      particulars: {
        contains_fixed_charge: true,
        contains_negative_pledge: true,
        description: "97 empress road. Kensington. Liverpool. L7 8SE.",
        type: "brief-description"
      },
      persons_entitled: [{ name: "Onesavings Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/12005578/filing-history/MzI4OTQwMTk1NGFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632988,
      published_at: "2021-01-25T12:27:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/11663349/charges/60F3deDPmlre0idDNODON2yuNHk",
    resource_id: "60F3deDPmlre0idDNODON2yuNHk",
    data: {
      charge_code: "116633490001",
      charge_number: 1,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-15",
      delivered_on: "2021-01-22",
      etag: "e19c20c9cc28c9cefa8c9a945e8177cd6fc98adf",
      links: { self: "/company/11663349/charges/60F3deDPmlre0idDNODON2yuNHk" },
      particulars: {
        contains_fixed_charge: true,
        contains_negative_pledge: true,
        description:
          "The leasehold property known as 92 walkden road, walkden, manchester M28 3DY demised by a lease made between mr. R. nuttall and mr. V. berry which is to be allocated a title number upon registration of the abovementioned lease out of the head leasehold title number GM905652 .",
        type: "brief-description"
      },
      persons_entitled: [{ name: "Gatehouse Bank PLC" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/11663349/filing-history/MzI4OTQyMTE3NWFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632993,
      published_at: "2021-01-25T12:28:01",
      type: "changed"
    }
  },
  {
    resource_kind: "company-charges",
    resource_uri: "/company/05144097/charges/W-_6NAZsYb4FShpClkS_g35hobE",
    resource_id: "W-_6NAZsYb4FShpClkS_g35hobE",
    data: {
      charge_code: "051440970010",
      charge_number: 10,
      classification: {
        description: "A registered charge",
        type: "charge-description"
      },
      created_on: "2021-01-11",
      delivered_on: "2021-01-22",
      etag: "b1991e754877e5eb1eaf5640e7bd26638bd4af1c",
      links: { self: "/company/05144097/charges/W-_6NAZsYb4FShpClkS_g35hobE" },
      particulars: {
        contains_fixed_charge: true,
        contains_negative_pledge: true
      },
      persons_entitled: [{ name: "Investec Bank (Channel Islands) Limited" }],
      status: "outstanding",
      transactions: [
        {
          delivered_on: "2021-01-22",
          filing_type: "create-charge-with-deed",
          links: {
            filing: "/company/05144097/filing-history/MzI4OTQyNTk4MGFkaXF6a2N4"
          }
        }
      ]
    },
    event: {
      timepoint: 632992,
      published_at: "2021-01-25T12:28:00",
      type: "changed"
    }
  }
];

const chargesEventSample: ChargesEvent.ChargesEvent = {
  resource_kind: "company-charges",
  resource_uri: "/company/OC431877/charges/VBBwVeFaa6qE7sCNOnCgRDJFusA",
  resource_id: "VBBwVeFaa6qE7sCNOnCgRDJFusA",
  data: {
    charge_code: "OC4318770001",
    charge_number: 1,
    classification: {
      description: "A registered charge",
      type: "charge-description"
    },
    created_on: "2020-10-02",
    delivered_on: "2020-10-07",
    etag: "d25838a6370ba9378a51fe56c12b8044429a67cc",
    links: {
      self: "/company/OC431877/charges/VBBwVeFaa6qE7sCNOnCgRDJFusA"
    },
    particulars: {
      contains_fixed_charge: true,
      contains_negative_pledge: true,
      description:
        "Freehold property at erskine street, liverpool formerly known as erskine industrial estate, registered at hm land registry under title under MS456395 together with land forming part of title number MS638597 shown hatched blue on the plan attached to the charge.",
      type: "brief-description"
    },
    persons_entitled: [
      {
        name: "Aura Liverpool Limited (In Administration)"
      }
    ],
    satisfied_on: "2021-01-24",
    status: "fully-satisfied",
    transactions: [
      {
        delivered_on: "2020-10-07",
        filing_type: "create-charge-with-deed-limited-liability-partnership",
        links: {
          filing: "/company/OC431877/filing-history/MzI3OTkzOTg4MWFkaXF6a2N4"
        }
      },
      {
        delivered_on: "2021-01-24",
        filing_type: "charge-satisfaction-limited-liability-partnership",
        links: {
          filing: "/company/OC431877/filing-history/MzI4OTUwNzk5OGFkaXF6a2N4"
        }
      }
    ]
  },
  event: {
    timepoint: 632251,
    published_at: "2021-01-24T21:26:01",
    type: "changed"
  }
};

const secondSampleChargeEvent: ChargesEvent.ChargesEvent = {
  resource_kind: "company-charges",
  resource_uri: "/company/OC431877/charges/VBBwVeFaa6qE7sCNOnCgRDJFusA",
  resource_id: "VBBwVeFaa6qE7sCNOnCgRDJFusA",
  data: {
    charge_code: "OC4318770001",
    charge_number: 1,
    classification: {
      description: "A registered charge",
      type: "charge-description"
    },
    created_on: "2020-10-02",
    delivered_on: "2020-10-07",
    etag: "d25838a6370ba9378a51fe56c12b8044429a67cc",
    links: {
      self: "/company/OC431877/charges/VBBwVeFaa6qE7sCNOnCgRDJFusA"
    },
    particulars: {
      contains_fixed_charge: true,
      contains_negative_pledge: true,
      description:
        "Freehold property at erskine street, liverpool formerly known as erskine industrial estate, registered at hm land registry under title under MS456395 together with land forming part of title number MS638597 shown hatched blue on the plan attached to the charge.",
      type: "brief-description"
    },
    persons_entitled: [
      {
        name: "Aura Liverpool Limited (In Administration)"
      }
    ],
    satisfied_on: "2021-01-24",
    status: "fully-satisfied",
    transactions: [
      {
        delivered_on: "2020-10-07",
        filing_type: "create-charge-with-deed-limited-liability-partnership",
        links: {
          filing: "/company/OC431877/filing-history/MzI3OTkzOTg4MWFkaXF6a2N4"
        }
      },
      {
        delivered_on: "2021-01-24",
        filing_type: "charge-satisfaction-limited-liability-partnership",
        links: {
          filing: "/company/OC431877/filing-history/MzI4OTUwNzk5OGFkaXF6a2N4"
        }
      }
    ]
  },
  event: {
    timepoint: 632250,
    published_at: "2021-01-24T21:26:01",
    type: "changed"
  }
};
