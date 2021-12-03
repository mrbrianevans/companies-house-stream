import * as request from "request"
import { getMongoClient } from "./getMongoClient"
import { MongoError } from "mongodb"
import * as logger from "node-color-log"
import { getCompanyInfo } from "./getCompanyInfo";
import { OfficerEvent } from "./types/eventTypes";

const TARGET_QUEUE_SIZE = 20
const MIN_DELAY = 200 //ms
const MAX_DELAY = 600_000 //ms (10 minutes)
export const StreamOfficers = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(() => {
      io.emit(
        "event",
        sampleOfficerEvents[
          Math.floor(Math.random() * sampleOfficerEvents.length)
        ]
      )
      StreamOfficers(io, "test")
    }, Math.random() * 10000)
  } else {
    let queue = []
    let dataBuffer = ""
    const reqStream = request
      .get("https://stream.companieshouse.gov.uk/officers")
      .auth(process.env.APIUSER, "")
      .on("response", (r: any) => {
        console.log("officer Headers received, status", r.statusCode)
        switch (r.statusCode) {
          case 200:
            console.log("Listening to updates on officer stream")
            break
          case 416:
            console.log("Timepoint out of date")
            break
          case 429:
            console.log("RATE LIMITED, exiting now")
            process.exit()
            break
          default:
            process.exit()
        }
      })
      .on("error", (e: any) => console.error("error", e))
      .on("data", async (d: any) => {
        if (d.toString().length > 1) {
          reqStream.pause()

          dataBuffer += d.toString("utf8")
          dataBuffer = dataBuffer.replace("}}{", "}}\n{")
          while (dataBuffer.includes("\n")) {
            let newLinePosition = dataBuffer.search("\n")
            let jsonText = dataBuffer.slice(0, newLinePosition)
            dataBuffer = dataBuffer.slice(newLinePosition + 1)
            if (jsonText.length === 0) continue
            try {
              let jsonObject = JSON.parse(jsonText)
              const [, companyNumber] = jsonObject.resource_uri.match(
                /^\/company\/([A-Z0-9]{6,8})\/appointments/
              )
              // save event in mongo db
              const client = await getMongoClient()
              try {
                await client
                  .db("events")
                  .collection("officer_events")
                  .insertOne({
                    _id: jsonObject.resource_id,
                    ...jsonObject,
                  })
                  .then(async () => {
                    // make sure company is in postgres otherwise put in not_found
                    const companyProfile = await getCompanyInfo(companyNumber)
                    // queue event because its not a duplicate, send company profile with event
                    queue.push({ ...jsonObject, companyProfile })
                  })
              } catch (e) {
                if (e instanceof MongoError && e.code != 11000)
                  logger
                    .color("red")
                    .log("failed to save company-event in mongodb")
                    .log("Message: ", e.message)
                    .log("Name: ", e.name)
                    .log("Code: ", e.code)
              } finally {
                await client.close()
              }
            } catch (e) {
              console.error(
                `\x1b[31mCOULD NOT PARSE officer: \x1b[0m*${jsonText}*`
              )
            }
          }
          reqStream.resume()
        } else {
          io.emit("heartbeat", {})
        }
      })
      .on("end", () => {
        console.error("officer stream ended")
      })
    let releasedCount = 0
    //console.log(`qtyReleased,queueLength,delay`)
    setInterval(() => {
      //console.log(`${releasedCount},${queue.length},${Math.round(delay)}`)
    }, 1000)
    let delay = 1000 // milliseconds between emits
    // shift the first event in the queue
    const releaseEvent = () => {
      // only release an event if there are more than zero queue length
      if (queue.length > 0) {
        releasedCount++
        io.emit("event", queue.shift())
      }
      //if the queue is shorter than desired, increase the delay, otherwise decrease it
      if (queue.length < TARGET_QUEUE_SIZE) delay *= 1.1
      else if (queue.length > TARGET_QUEUE_SIZE) delay /= 1.1
      delay = Math.max(Math.round(delay), MIN_DELAY) // prevent going below MIN_DELAY
      delay = Math.min(Math.round(delay), MAX_DELAY) // prevent going above MAX_DELAY
      setTimeout(releaseEvent, delay)
    }
    releaseEvent()
  }
}

const sampleOfficerEvents: OfficerEvent.OfficerEvent[] = [
  {
    resource_kind: "company-officers",
    resource_uri: "/company/06063711/appointments/oa07QETFwXYZSQmyaBvqR1Fvp6w",
    resource_id: "oa07QETFwXYZSQmyaBvqR1Fvp6w",
    data: {
      address: {
        address_line_1: "Market Street",
        address_line_2: "New Mills",
        locality: "High Peak",
        postal_code: "SK22 4AA",
        premises: "36a",
        region: "Derbyshire",
      },
      appointed_on: "2017-05-12",
      country_of_residence: "England",
      date_of_birth: { month: 4, year: 1963 },
      links: {
        self: "/company/06063711/appointments/oa07QETFwXYZSQmyaBvqR1Fvp6w",
      },
      name: "HARBIDGE, Ian Arthur Joseph",
      nationality: "British",
      occupation: "Bdm",
      officer_role: "director",
    },
    event: {
      timepoint: 2240294,
      published_at: "2021-08-20T13:33:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/08684126/appointments/SEupvfcsN5ll8o3GcOTzyIfCYQM",
    resource_id: "SEupvfcsN5ll8o3GcOTzyIfCYQM",
    data: {
      address: {
        address_line_1: "Solar House",
        address_line_2: "915 High Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "N12 8QJ",
        premises: "C/O D & K Accountancy Services Limited",
      },
      appointed_on: "2013-09-10",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 11, year: 1974 },
      links: {
        self: "/company/08684126/appointments/SEupvfcsN5ll8o3GcOTzyIfCYQM",
      },
      name: "HAROLD, Liselle",
      nationality: "British",
      occupation: "Social Worker",
      officer_role: "director",
    },
    event: {
      timepoint: 2240295,
      published_at: "2021-08-20T13:33:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/12652253/appointments/y5qBx6oSNB7I0lw4HVITEs77LSk",
    resource_id: "y5qBx6oSNB7I0lw4HVITEs77LSk",
    data: {
      address: {
        address_line_1: "Pulleyns Avenue East Ham",
        country: "England",
        locality: "London",
        postal_code: "E6 3NA",
        premises: "43",
      },
      appointed_on: "2020-06-08",
      country_of_residence: "England",
      date_of_birth: { month: 12, year: 1996 },
      links: {
        self: "/company/12652253/appointments/y5qBx6oSNB7I0lw4HVITEs77LSk",
      },
      name: "KHAWAR, Wasiq",
      nationality: "Pakistani",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240296,
      published_at: "2021-08-20T13:33:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11192641/appointments/g2ve7mPDdmsNKfez4e8zP1sAkwo",
    resource_id: "g2ve7mPDdmsNKfez4e8zP1sAkwo",
    data: {
      address: {
        address_line_1: "Station Approach",
        address_line_2: "Borough Green",
        country: "England",
        locality: "Sevenoaks",
        postal_code: "TN15 8AD",
        premises: "Gallium  House, Unit 2",
      },
      appointed_on: "2021-08-19",
      country_of_residence: "England",
      date_of_birth: { month: 3, year: 1966 },
      links: {
        self: "/company/11192641/appointments/g2ve7mPDdmsNKfez4e8zP1sAkwo",
      },
      name: "HUGHES, Evelyn Mary",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240297,
      published_at: "2021-08-20T13:33:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577243/appointments/Uyxm2eT5wCDd8qmBkVG2lU6EtYc",
    resource_id: "Uyxm2eT5wCDd8qmBkVG2lU6EtYc",
    data: {
      address: {
        address_line_1: "Blakesley Road",
        country: "England",
        locality: "Birmingham",
        postal_code: "B25 8RP",
        premises: "158",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 1, year: 1957 },
      links: {
        self: "/company/13577243/appointments/Uyxm2eT5wCDd8qmBkVG2lU6EtYc",
      },
      name: "COOKE, Malcolm",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240298,
      published_at: "2021-08-20T13:33:13",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577238/appointments/iz2rEmXo8r3xhGu-l4qvZ1Slg4A",
    resource_id: "iz2rEmXo8r3xhGu-l4qvZ1Slg4A",
    data: {
      address: {
        address_line_1: "Burgess Hill",
        country: "England",
        locality: "London",
        postal_code: "NW2 2DD",
        premises: "19",
      },
      appointed_on: "2021-08-20",
      links: {
        self: "/company/13577238/appointments/iz2rEmXo8r3xhGu-l4qvZ1Slg4A",
      },
      name: "CORRIGAN, Daniel John",
      officer_role: "secretary",
    },
    event: {
      timepoint: 2240299,
      published_at: "2021-08-20T13:33:20",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577247/appointments/uSwsfz-RwLPQ7ockuhLXM57iH7U",
    resource_id: "uSwsfz-RwLPQ7ockuhLXM57iH7U",
    data: {
      address: {
        address_line_1: "16c Capital Tower",
        address_line_2: "91 Waterloo Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "SE1 8RT",
        premises: "9.17",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 11, year: 1970 },
      links: {
        self: "/company/13577247/appointments/uSwsfz-RwLPQ7ockuhLXM57iH7U",
      },
      name: "JUMU, Franklyn",
      nationality: "British",
      occupation: "Business Person",
      officer_role: "director",
    },
    event: {
      timepoint: 2240321,
      published_at: "2021-08-20T13:34:09",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577238/appointments/DYzZ-zRcWT6WUYuHGiYYfqORmcc",
    resource_id: "DYzZ-zRcWT6WUYuHGiYYfqORmcc",
    data: {
      address: {
        address_line_1: "Burgess Hill",
        country: "England",
        locality: "London",
        postal_code: "NW2 2DD",
        premises: "19",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 4, year: 1991 },
      links: {
        self: "/company/13577238/appointments/DYzZ-zRcWT6WUYuHGiYYfqORmcc",
      },
      name: "CORRIGAN, Ben Matthew",
      nationality: "British",
      occupation: "Chief Operating Officer",
      officer_role: "director",
    },
    event: {
      timepoint: 2240322,
      published_at: "2021-08-20T13:34:19",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577247/appointments/wsqvrUznICuGCTJBdp4dTSK8_FQ",
    resource_id: "wsqvrUznICuGCTJBdp4dTSK8_FQ",
    data: {
      address: {
        address_line_1: "16c Capital Tower",
        address_line_2: "91 Waterloo Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "SE1 8RT",
        premises: "9.17",
      },
      appointed_on: "2021-08-20",
      links: {
        self: "/company/13577247/appointments/wsqvrUznICuGCTJBdp4dTSK8_FQ",
      },
      name: "ZENIOS, Stella",
      officer_role: "secretary",
    },
    event: {
      timepoint: 2240323,
      published_at: "2021-08-20T13:34:30",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577249/appointments/6Gqknd8cUVH7vvCTdybbOzE9Kn0",
    resource_id: "6Gqknd8cUVH7vvCTdybbOzE9Kn0",
    data: {
      address: {
        address_line_1: "Breakback Road",
        address_line_2: "Charford",
        country: "England",
        locality: "Bromsgrove",
        postal_code: "B61 7LU",
        premises: "54a",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 11, year: 1967 },
      links: {
        self: "/company/13577249/appointments/6Gqknd8cUVH7vvCTdybbOzE9Kn0",
      },
      name: "MORGAN, Christine",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240324,
      published_at: "2021-08-20T13:34:31",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577248/appointments/IsnSMtKI518lJ4F_g76LqAcEfdI",
    resource_id: "IsnSMtKI518lJ4F_g76LqAcEfdI",
    data: {
      address: {
        address_line_1: "Heap Bridge",
        country: "England",
        locality: "Bury",
        postal_code: "BL9 7HR",
        premises: "2",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 8, year: 1969 },
      links: {
        self: "/company/13577248/appointments/IsnSMtKI518lJ4F_g76LqAcEfdI",
      },
      name: "BUCHANAN, Mark Joseph",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240325,
      published_at: "2021-08-20T13:34:45",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577246/appointments/UEQAJ_vuur97a8Lz8oFzgbbiirQ",
    resource_id: "UEQAJ_vuur97a8Lz8oFzgbbiirQ",
    data: {
      address: {
        address_line_1: "Wenlock Road",
        country: "England",
        locality: "London",
        postal_code: "N1 7GU",
        premises: "20-22",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 9, year: 1983 },
      links: {
        self: "/company/13577246/appointments/UEQAJ_vuur97a8Lz8oFzgbbiirQ",
      },
      name: "MCILDOWNEY, Gary",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240326,
      published_at: "2021-08-20T13:34:58",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/07355673/appointments/TZUQ-eqVJmrmjGElFvtSfwRddCI",
    resource_id: "TZUQ-eqVJmrmjGElFvtSfwRddCI",
    data: {
      address: {
        address_line_1: "Crown House",
        address_line_2: "North Circular Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "NW10 7PN",
        premises: "415",
      },
      appointed_on: "2010-08-24",
      country_of_residence: "England",
      date_of_birth: { month: 10, year: 1977 },
      links: {
        self: "/company/07355673/appointments/TZUQ-eqVJmrmjGElFvtSfwRddCI",
      },
      name: "RAHAD, Khaled",
      nationality: "British",
      occupation: "Manager",
      officer_role: "director",
    },
    event: {
      timepoint: 2240327,
      published_at: "2021-08-20T13:35:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13335119/appointments/NBvj4gW7GVKeP7cwv05RGemU7x8",
    resource_id: "NBvj4gW7GVKeP7cwv05RGemU7x8",
    data: {
      address: {
        address_line_1: "Solar House",
        address_line_2: "915 High Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "N12 8QJ",
        premises: "C/O D & K Accountancy Services Limited",
      },
      appointed_on: "2021-04-14",
      country_of_residence: "England",
      date_of_birth: { month: 2, year: 2003 },
      links: {
        self: "/company/13335119/appointments/NBvj4gW7GVKeP7cwv05RGemU7x8",
      },
      name: "KING, Lewis Anthony Gavin",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240328,
      published_at: "2021-08-20T13:35:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/06613927/appointments/qCbeYHdoXXLz9EOLk78Ptdj95h0",
    resource_id: "qCbeYHdoXXLz9EOLk78Ptdj95h0",
    data: {
      address: {
        address_line_1: "76 Buckingham Palace Road",
        locality: "London",
        postal_code: "SW1W 9AX",
        premises: "Belgrave House",
      },
      appointed_on: "2017-09-06",
      links: {
        self: "/company/06613927/appointments/qCbeYHdoXXLz9EOLk78Ptdj95h0",
      },
      name: "MUDDIMAN, David James",
      officer_role: "secretary",
      resigned_on: "2021-08-20",
    },
    event: {
      timepoint: 2240329,
      published_at: "2021-08-20T13:35:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577240/appointments/1x9JPsQ7DVXOqxl02UOtWKv6XGs",
    resource_id: "1x9JPsQ7DVXOqxl02UOtWKv6XGs",
    data: {
      address: {
        address_line_1: "11 South Hawksworth Street",
        country: "England",
        locality: "Ilkley",
        postal_code: "LS29 9DX",
        premises: "Moor House",
        region: "West Yorkshire",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 5, year: 1997 },
      links: {
        self: "/company/13577240/appointments/1x9JPsQ7DVXOqxl02UOtWKv6XGs",
      },
      name: "IREZ, Selim",
      nationality: "Turkish",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240330,
      published_at: "2021-08-20T13:35:09",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577250/appointments/TSu8e0musqaNIKA8O4bh8fAp_RQ",
    resource_id: "TSu8e0musqaNIKA8O4bh8fAp_RQ",
    data: {
      address: {
        address_line_1: "90-92 Baxter Avenue",
        country: "United Kingdom",
        locality: "Southend On Sea",
        postal_code: "SS2 6HZ",
        premises: "Rutland House",
        region: "Essex",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 9, year: 1953 },
      links: {
        self: "/company/13577250/appointments/TSu8e0musqaNIKA8O4bh8fAp_RQ",
      },
      name: "RASHID, Mohammad Jaweed",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240331,
      published_at: "2021-08-20T13:35:18",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577251/appointments/Bh2JAkzOANxNlWcYkOJhiyABCJ4",
    resource_id: "Bh2JAkzOANxNlWcYkOJhiyABCJ4",
    data: {
      address: {
        address_line_1: "Pine Close",
        address_line_2: "Newburgh",
        country: "England",
        locality: "Wigan",
        postal_code: "WN8 7LD",
        premises: "4",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 9, year: 1973 },
      links: {
        self: "/company/13577251/appointments/Bh2JAkzOANxNlWcYkOJhiyABCJ4",
      },
      name: "GREEN, Neil",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240332,
      published_at: "2021-08-20T13:35:22",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577252/appointments/Vksu6xuh8FJknplv_2iUc7OSoGE",
    resource_id: "Vksu6xuh8FJknplv_2iUc7OSoGE",
    data: {
      address: {
        address_line_1: "Pembrokeshire Science And Technology Park",
        country: "Wales",
        locality: "Pembroke Dock",
        postal_code: "SA72 6UN",
        premises: "Bridge Innovation Centre",
        region: "Pembrokeshire",
      },
      appointed_on: "2021-08-20",
      identification: {
        identification_type: "uk-limited-company",
        registration_number: "12482705",
      },
      links: {
        self: "/company/13577252/appointments/Vksu6xuh8FJknplv_2iUc7OSoGE",
      },
      name: "TS SPV 1 LIMITED",
      officer_role: "corporate-director",
    },
    event: {
      timepoint: 2240333,
      published_at: "2021-08-20T13:35:50",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/09516708/appointments/Ms3nJ93cbJhM-swOpGHvA7W6WXI",
    resource_id: "Ms3nJ93cbJhM-swOpGHvA7W6WXI",
    data: {
      address: {
        address_line_1: "South Cambridge Business Park",
        address_line_2: "Babraham Road, Sawston",
        country: "England",
        locality: "Cambridge",
        postal_code: "CB22 3JH",
        premises: "Unit D",
      },
      appointed_on: "2015-03-28",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 5, year: 1961 },
      links: {
        self: "/company/09516708/appointments/Ms3nJ93cbJhM-swOpGHvA7W6WXI",
      },
      name: "MARINO, Giulio Aldo",
      nationality: "Italian",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240334,
      published_at: "2021-08-20T13:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/09516708/appointments/FyiQVjShQA3lffDPCs2Fh7xZrYI",
    resource_id: "FyiQVjShQA3lffDPCs2Fh7xZrYI",
    data: {
      address: {
        address_line_1: "South Cambridge Business Park",
        address_line_2: "Babraham Road, Sawston",
        country: "England",
        locality: "Cambridge",
        postal_code: "CB22 3JH",
        premises: "Unit D",
      },
      appointed_on: "2017-01-14",
      country_of_residence: "England",
      date_of_birth: { month: 3, year: 1986 },
      links: {
        self: "/company/09516708/appointments/FyiQVjShQA3lffDPCs2Fh7xZrYI",
      },
      name: "SAWFORD, Danielle",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240335,
      published_at: "2021-08-20T13:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11531623/appointments/hr3PJK7WbO_9Zdj1IEO5UYMoyDk",
    resource_id: "hr3PJK7WbO_9Zdj1IEO5UYMoyDk",
    data: {
      address: {
        address_line_1: "7 Hydra Orion Court",
        address_line_2: "Addison Way",
        country: "United Kingdom",
        locality: "Great Blakenham, Ipswich",
        postal_code: "IP6 0LW",
        premises: "Lb Group, Suffolk House",
        region: "Suffolk",
      },
      appointed_on: "2018-08-22",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 2, year: 1986 },
      links: {
        self: "/company/11531623/appointments/hr3PJK7WbO_9Zdj1IEO5UYMoyDk",
      },
      name: "MORINIERE, Freddy",
      nationality: "French,British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240336,
      published_at: "2021-08-20T13:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/12841892/appointments/PNq7vlnhnGF-U1D1D92WDqm2LM8",
    resource_id: "PNq7vlnhnGF-U1D1D92WDqm2LM8",
    data: {
      address: {
        address_line_1: "Valley Lane",
        country: "United Kingdom",
        locality: "Stowmarket",
        postal_code: "IP14 3BE",
        premises: "Dairy Farm House",
        region: "Suffolk",
      },
      appointed_on: "2020-08-27",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 2, year: 1986 },
      links: {
        self: "/company/12841892/appointments/PNq7vlnhnGF-U1D1D92WDqm2LM8",
      },
      name: "MORINIERE, Freddy",
      nationality: "French,British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240337,
      published_at: "2021-08-20T13:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/09853168/appointments/U1kTIjodX2QnpG5Xc92MdMybBjw",
    resource_id: "U1kTIjodX2QnpG5Xc92MdMybBjw",
    data: {
      address: {
        address_line_1: "Sevenkings",
        country: "United Kingdom",
        locality: "Ilford",
        postal_code: "IG3 9HH",
        premises: "25 Gyllyngdune Gardens",
        region: "Essex",
      },
      appointed_on: "2019-09-22",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/09853168/appointments/U1kTIjodX2QnpG5Xc92MdMybBjw",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240338,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/OC330343/appointments/EBGql9W9M7zpvldIeRcss5w85TM",
    resource_id: "EBGql9W9M7zpvldIeRcss5w85TM",
    data: {
      address: {
        address_line_1: "Green Lane",
        address_line_2: "Seven Kings",
        country: "United Kingdom",
        locality: "Ilford",
        postal_code: "IG3 9JS",
        premises: "352b",
        region: "Essex",
      },
      appointed_on: "2007-08-06",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/OC330343/appointments/EBGql9W9M7zpvldIeRcss5w85TM",
      },
      name: "ZAHOOR, Abbas",
      officer_role: "llp-designated-member",
    },
    event: {
      timepoint: 2240339,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/OC432675/appointments/c9Cww6WlG5cmYpaeVDctcEq9WiY",
    resource_id: "c9Cww6WlG5cmYpaeVDctcEq9WiY",
    data: {
      address: {
        address_line_1: "Priors Grange",
        country: "England",
        locality: "High Pittington",
        postal_code: "DH6 1DE",
        premises: "166",
        region: "County Durham",
      },
      appointed_on: "2020-07-22",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 6, year: 1981 },
      links: {
        self: "/company/OC432675/appointments/c9Cww6WlG5cmYpaeVDctcEq9WiY",
      },
      name: "TATESON, Charles Mcvoy",
      officer_role: "llp-designated-member",
    },
    event: {
      timepoint: 2240340,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/OC432675/appointments/LUsGHWRnkSaZaR8jt46B__e9qA0",
    resource_id: "LUsGHWRnkSaZaR8jt46B__e9qA0",
    data: {
      address: {
        address_line_1: "Priors Grange",
        country: "England",
        locality: "High Pittington",
        postal_code: "DH6 1DE",
        premises: "166",
        region: "County Durham",
      },
      appointed_on: "2020-07-22",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 6, year: 1983 },
      links: {
        self: "/company/OC432675/appointments/LUsGHWRnkSaZaR8jt46B__e9qA0",
      },
      name: "TATESON, Jaymie Louise",
      officer_role: "llp-designated-member",
    },
    event: {
      timepoint: 2240341,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11531574/appointments/UOb8OvOZWmW_YRb9ptsE-O3vkUA",
    resource_id: "UOb8OvOZWmW_YRb9ptsE-O3vkUA",
    data: {
      address: {
        address_line_1: "7 Hydra Orion Court",
        address_line_2: "Addison Way",
        country: "United Kingdom",
        locality: "Great Blakenham, Ipswich",
        postal_code: "IP6 0LW",
        premises: "Lb Group, Suffolk House",
        region: "Suffolk",
      },
      appointed_on: "2018-08-22",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 2, year: 1986 },
      links: {
        self: "/company/11531574/appointments/UOb8OvOZWmW_YRb9ptsE-O3vkUA",
      },
      name: "MORINIERE, Freddy",
      nationality: "French,British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240342,
      published_at: "2021-08-20T13:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/75kxrIm6w_lCJdrC2Gs-f-aXj-4",
    resource_id: "75kxrIm6w_lCJdrC2Gs-f-aXj-4",
    data: {
      address: {
        address_line_1: "Cannon Way",
        address_line_2: "Higher Kinnerton",
        country: "United Kingdom",
        locality: "Chester",
        postal_code: "CH4 9PG",
        premises: "17",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 11, year: 1975 },
      links: {
        self: "/company/13577263/appointments/75kxrIm6w_lCJdrC2Gs-f-aXj-4",
      },
      name: "SPRAY, Iain James, Mr,",
      nationality: "British",
      occupation: "Marketing Consultant",
      officer_role: "director",
    },
    event: {
      timepoint: 2240343,
      published_at: "2021-08-20T13:36:03",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/06301718/appointments/LUqebS7jf57l2ZH0HLllZ5wYKzc",
    resource_id: "LUqebS7jf57l2ZH0HLllZ5wYKzc",
    data: {
      address: {
        address_line_1: "76 Buckingham Palace Road",
        locality: "London",
        postal_code: "SW1W 9AX",
        premises: "Belgrave House",
      },
      appointed_on: "2017-09-27",
      links: {
        self: "/company/06301718/appointments/LUqebS7jf57l2ZH0HLllZ5wYKzc",
      },
      name: "MUDDIMAN, David James",
      officer_role: "secretary",
      resigned_on: "2021-08-20",
    },
    event: {
      timepoint: 2240344,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11301172/appointments/NPq3kzk5pI6vlMHAbl1jDnIuF_8",
    resource_id: "NPq3kzk5pI6vlMHAbl1jDnIuF_8",
    data: {
      address: {
        address_line_1: "Newbury Park",
        country: "United Kingdom",
        locality: "Ilford",
        postal_code: "IG2 7JD",
        premises: "962 Eastern Avenue",
        region: "Essex",
      },
      appointed_on: "2018-04-10",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/11301172/appointments/NPq3kzk5pI6vlMHAbl1jDnIuF_8",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240345,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/12785787/appointments/haGQgytM3x6fMU2cMw6kU4ckvZw",
    resource_id: "haGQgytM3x6fMU2cMw6kU4ckvZw",
    data: {
      address: {
        address_line_1: "43 Gazelle House",
        address_line_2: "8 Manbey Park Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "E15 1EQ",
        premises: "43",
        region: "London",
      },
      appointed_on: "2020-08-02",
      country_of_residence: "England",
      date_of_birth: { month: 8, year: 1995 },
      links: {
        self: "/company/12785787/appointments/haGQgytM3x6fMU2cMw6kU4ckvZw",
      },
      name: "BERDILO, Corneliu",
      nationality: "Romanian,Moldovan",
      occupation: "Business Person",
      officer_role: "director",
    },
    event: {
      timepoint: 2240346,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/01833139/appointments/yHdFDU7BYe5k4x9jQGftwXJZSFY",
    resource_id: "yHdFDU7BYe5k4x9jQGftwXJZSFY",
    data: {
      address: {
        address_line_1: "Belgrave House",
        address_line_2: "76 Buckingham Palace Road",
        locality: "London",
        postal_code: "SW1W 9AX",
      },
      appointed_on: "2017-10-02",
      links: {
        self: "/company/01833139/appointments/yHdFDU7BYe5k4x9jQGftwXJZSFY",
      },
      name: "MUDDIMAN, David James",
      officer_role: "secretary",
      resigned_on: "2021-08-20",
    },
    event: {
      timepoint: 2240347,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/08433406/appointments/V5kDDocN6GgC4G1zHFUxKJuHLRo",
    resource_id: "V5kDDocN6GgC4G1zHFUxKJuHLRo",
    data: {
      address: {
        address_line_1: "Eastern Avenue",
        address_line_2: "Newbury Park",
        country: "United Kingdom",
        locality: "Ilford",
        postal_code: "IG2 7JD",
        premises: "962",
        region: "Essex",
      },
      appointed_on: "2013-03-07",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/08433406/appointments/V5kDDocN6GgC4G1zHFUxKJuHLRo",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240348,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/10345936/appointments/JGg0Lbbvi9MovnKldhrEiPy2SLc",
    resource_id: "JGg0Lbbvi9MovnKldhrEiPy2SLc",
    data: {
      address: {
        address_line_1: "Station Approach",
        address_line_2: "Borough Green",
        country: "England",
        locality: "Sevenoaks",
        postal_code: "TN15 8AD",
        premises: "Gallium  House, Unit 2",
      },
      appointed_on: "2021-08-19",
      country_of_residence: "England",
      date_of_birth: { month: 3, year: 1953 },
      links: {
        self: "/company/10345936/appointments/JGg0Lbbvi9MovnKldhrEiPy2SLc",
      },
      name: "BAILEY, Michael William",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240349,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/NI636189/appointments/nPxbY81bnrRB7wHvQ2vIO3fISBE",
    resource_id: "nPxbY81bnrRB7wHvQ2vIO3fISBE",
    data: {
      address: {
        address_line_1: "Ballynahinch Road",
        address_line_2: "Carryduff",
        country: "Northern Ireland",
        locality: "Belfast",
        postal_code: "BT8 8DN",
        premises: "Emerson House",
      },
      appointed_on: "2021-08-13",
      country_of_residence: "United States",
      date_of_birth: { month: 3, year: 1982 },
      links: {
        self: "/company/NI636189/appointments/nPxbY81bnrRB7wHvQ2vIO3fISBE",
      },
      name: "CASTLEFORTE, Michael Daniel",
      nationality: "American",
      occupation: "Partner, Private Equity",
      officer_role: "director",
    },
    event: {
      timepoint: 2240350,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/07986993/appointments/P3-Ag6BUbqlG1napoMMMNOjS1HI",
    resource_id: "P3-Ag6BUbqlG1napoMMMNOjS1HI",
    data: {
      address: {
        address_line_1: "Green Lane",
        country: "United Kingdom",
        locality: "Sevenkings",
        postal_code: "IG3 9JS",
        premises: "352-B",
        region: "Essex",
      },
      appointed_on: "2012-03-12",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/07986993/appointments/P3-Ag6BUbqlG1napoMMMNOjS1HI",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240351,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/05580952/appointments/gppx-VeDKS3xhmSZYEkB56ik8Bk",
    resource_id: "gppx-VeDKS3xhmSZYEkB56ik8Bk",
    data: {
      address: {
        address_line_1: "25 Gyllyngdune Gardens",
        locality: "Ilford",
        postal_code: "IG3 9HH",
        region: "Essex",
      },
      appointed_on: "2005-11-29",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/05580952/appointments/gppx-VeDKS3xhmSZYEkB56ik8Bk",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240352,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577261/appointments/6hy-qTjPDv6_q_r9s0jovqT2u7g",
    resource_id: "6hy-qTjPDv6_q_r9s0jovqT2u7g",
    data: {
      address: {
        address_line_1: "160 City Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "EC1V 2NX",
        premises: "Kemp House",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 6, year: 1981 },
      links: {
        self: "/company/13577261/appointments/6hy-qTjPDv6_q_r9s0jovqT2u7g",
      },
      name: "TATESON, Charles Mcvoy",
      nationality: "British",
      occupation: "Tax Consultant",
      officer_role: "director",
    },
    event: {
      timepoint: 2240353,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577261/appointments/0SCazXAaR7eLojL_YWvPsbEJuGY",
    resource_id: "0SCazXAaR7eLojL_YWvPsbEJuGY",
    data: {
      address: {
        address_line_1: "Priors Grange",
        country: "United Kingdom",
        locality: "High Pittington",
        postal_code: "DH6 1DE",
        premises: "166",
        region: "Durham, County Of",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 6, year: 1983 },
      links: {
        self: "/company/13577261/appointments/0SCazXAaR7eLojL_YWvPsbEJuGY",
      },
      name: "TATESON, Jaymie Louise",
      nationality: "British",
      occupation: "Teacher",
      officer_role: "director",
    },
    event: {
      timepoint: 2240354,
      published_at: "2021-08-20T13:36:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/8Z7ETWdS49jeksvEbAhIM-1Zx3Y",
    resource_id: "8Z7ETWdS49jeksvEbAhIM-1Zx3Y",
    data: {
      address: {
        address_line_1: "Woodlands Close",
        address_line_2: "Parkgate",
        country: "United Kingdom",
        locality: "Neston",
        postal_code: "CH64 6RU",
        premises: "3",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 3, year: 1979 },
      links: {
        self: "/company/13577263/appointments/8Z7ETWdS49jeksvEbAhIM-1Zx3Y",
      },
      name: "MANUEL, Ari Roger Gyan, Dr.",
      nationality: "British",
      occupation: "Doctor",
      officer_role: "director",
    },
    event: {
      timepoint: 2240355,
      published_at: "2021-08-20T13:36:03",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/wWkC5YbFq3xkY5RwgFlFOS0meuY",
    resource_id: "wWkC5YbFq3xkY5RwgFlFOS0meuY",
    data: {
      address: {
        address_line_1: "Stumperlowe Hall Road",
        country: "England",
        locality: "Sheffield",
        postal_code: "S10 3QR",
        premises: "2",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 3, year: 1979 },
      links: {
        self: "/company/13577263/appointments/wWkC5YbFq3xkY5RwgFlFOS0meuY",
      },
      name: "IYER, Sriram, Dr.",
      nationality: "British",
      occupation: "Doctor",
      officer_role: "director",
    },
    event: {
      timepoint: 2240356,
      published_at: "2021-08-20T13:36:03",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577258/appointments/vw6vKa_HASJG9tUEVRaaRIVvbdY",
    resource_id: "vw6vKa_HASJG9tUEVRaaRIVvbdY",
    data: {
      address: {
        address_line_1: "Abingdon Road",
        country: "England",
        locality: "Birmingham",
        postal_code: "B23 5HX",
        premises: "119",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 6, year: 1993 },
      links: {
        self: "/company/13577258/appointments/vw6vKa_HASJG9tUEVRaaRIVvbdY",
      },
      name: "DOYLE, Joseph",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240357,
      published_at: "2021-08-20T13:36:11",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/8jq03a4uJbgwBNMI7iLuymRg6Wo",
    resource_id: "8jq03a4uJbgwBNMI7iLuymRg6Wo",
    data: {
      address: {
        address_line_1: "5th Floor",
        address_line_2: "58 Nicholas Street",
        country: "United Kingdom",
        locality: "Chester",
        postal_code: "CH1 2NP",
        premises: "Hq",
        region: "Cheshire",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 6, year: 1961 },
      links: {
        self: "/company/13577263/appointments/8jq03a4uJbgwBNMI7iLuymRg6Wo",
      },
      name: "WEBB, William John, Mr,",
      nationality: "British",
      occupation: "Accountant",
      officer_role: "director",
    },
    event: {
      timepoint: 2240358,
      published_at: "2021-08-20T13:36:03",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/j54dxQj6FggLkMs0hVtojkIp52w",
    resource_id: "j54dxQj6FggLkMs0hVtojkIp52w",
    data: {
      address: {
        address_line_1: "Nicholas Street",
        country: "United Kingdom",
        locality: "Chester",
        postal_code: "CH1 2NP",
        premises: "58",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 5, year: 1958 },
      links: {
        self: "/company/13577263/appointments/j54dxQj6FggLkMs0hVtojkIp52w",
      },
      name: "WIFFEN, Richard Austin, Mr,",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240359,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577253/appointments/z992E-jZ8NGDkN35KyR8_a3UY1o",
    resource_id: "z992E-jZ8NGDkN35KyR8_a3UY1o",
    data: {
      address: {
        country: "United Kingdom",
        locality: "Borehamwood",
        postal_code: "WD6 5QR",
        premises: "7 Banks Road",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 4, year: 1995 },
      links: {
        self: "/company/13577253/appointments/z992E-jZ8NGDkN35KyR8_a3UY1o",
      },
      name: "QARRI, Marjan",
      nationality: "Albanian",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240360,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577263/appointments/jgGDv_EqLsuNhosmH5S_P_Ik1Lo",
    resource_id: "jgGDv_EqLsuNhosmH5S_P_Ik1Lo",
    data: {
      address: {
        address_line_1: "Nicholas Street",
        country: "United Kingdom",
        locality: "Chester",
        postal_code: "CH1 2NP",
        premises: "58",
      },
      appointed_on: "2021-08-20",
      links: {
        self: "/company/13577263/appointments/jgGDv_EqLsuNhosmH5S_P_Ik1Lo",
      },
      name: "WEBB, William John, Mr,",
      officer_role: "secretary",
    },
    event: {
      timepoint: 2240361,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/09925071/appointments/5sWUK3c3zbrRHM-fRv2w58voUaU",
    resource_id: "5sWUK3c3zbrRHM-fRv2w58voUaU",
    data: {
      address: {
        address_line_1: "Severn View Drive",
        address_line_2: "Eardington",
        country: "England",
        locality: "Bridgnorth",
        postal_code: "WV16 5JR",
        premises: "15",
      },
      appointed_on: "2015-12-21",
      country_of_residence: "England",
      date_of_birth: { month: 6, year: 1970 },
      links: {
        self: "/company/09925071/appointments/5sWUK3c3zbrRHM-fRv2w58voUaU",
      },
      name: "MITCHELL, Jonathan Paul",
      nationality: "British",
      occupation: "Electrician",
      officer_role: "director",
    },
    event: {
      timepoint: 2240362,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/12354133/appointments/Y9RALGWV8HRoE6uh4Trj_XHPRQE",
    resource_id: "Y9RALGWV8HRoE6uh4Trj_XHPRQE",
    data: {
      address: {
        address_line_1: "South Dupont Highway",
        care_of: "INCORPORATING SERVICES, LTD.",
        country: "United States",
        locality: "Dover",
        postal_code: "19901",
        premises: "3500",
        region: "Delaware",
      },
      appointed_on: "2021-08-12",
      country_of_residence: "United States",
      date_of_birth: { month: 4, year: 1968 },
      links: {
        self: "/company/12354133/appointments/Y9RALGWV8HRoE6uh4Trj_XHPRQE",
      },
      name: "SHARMA, Rohit",
      nationality: "Indian",
      occupation: "Investor",
      officer_role: "director",
    },
    event: {
      timepoint: 2240363,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577265/appointments/JqIEEfKCE39r3JYvgJknNHyHuy4",
    resource_id: "JqIEEfKCE39r3JYvgJknNHyHuy4",
    data: {
      address: {
        address_line_1: "Llay Industrial Estate",
        address_line_2: "Llay",
        country: "United Kingdom",
        locality: "Wrexham",
        postal_code: "LL12 0PJ",
        premises: "Miners Park Miners Road",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 1, year: 1997 },
      links: {
        self: "/company/13577265/appointments/JqIEEfKCE39r3JYvgJknNHyHuy4",
      },
      name: "WHITTAKER, Christopher George",
      nationality: "British",
      occupation: "Logistics And Business Development Office",
      officer_role: "director",
    },
    event: {
      timepoint: 2240364,
      published_at: "2021-08-20T13:36:04",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/10668656/appointments/P2VD-p1is51J7Fx_JJMwtFAUmH4",
    resource_id: "P2VD-p1is51J7Fx_JJMwtFAUmH4",
    data: {
      address: {
        address_line_1: "Littlebrook Avenue",
        country: "England",
        locality: "Slough",
        postal_code: "SL2 2PE",
        premises: "193",
      },
      appointed_on: "2021-08-07",
      country_of_residence: "England",
      date_of_birth: { month: 12, year: 1959 },
      links: {
        self: "/company/10668656/appointments/P2VD-p1is51J7Fx_JJMwtFAUmH4",
      },
      name: "NASH, John Talbot Francis",
      nationality: "British",
      occupation: "Ned",
      officer_role: "director",
    },
    event: {
      timepoint: 2240365,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/10345936/appointments/Pa9jBdNOok4Gsf5xKcCmUe665pI",
    resource_id: "Pa9jBdNOok4Gsf5xKcCmUe665pI",
    data: {
      address: {
        address_line_1: "Station Court",
        address_line_2: "Borough Green",
        country: "England",
        locality: "Sevenoaks",
        postal_code: "TN15 8AD",
        premises: "Unit 2",
      },
      appointed_on: "2016-08-25",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 2, year: 1963 },
      links: {
        self: "/company/10345936/appointments/Pa9jBdNOok4Gsf5xKcCmUe665pI",
      },
      name: "NORRIS, Anthony Carmelo",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
      resigned_on: "2021-08-19",
    },
    event: {
      timepoint: 2240366,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/05163695/appointments/XsMOdywATHtDRLu1QTqPe6-ubxQ",
    resource_id: "XsMOdywATHtDRLu1QTqPe6-ubxQ",
    data: {
      address: {
        address_line_1: "Buckingham Palace Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "SW1W 9AX",
        premises: "76",
      },
      appointed_on: "2017-09-11",
      links: {
        self: "/company/05163695/appointments/XsMOdywATHtDRLu1QTqPe6-ubxQ",
      },
      name: "MUDDIMAN, David James",
      officer_role: "secretary",
      resigned_on: "2021-08-20",
    },
    event: {
      timepoint: 2240367,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/08967583/appointments/rmY4LdeNlwB6RPN05CfJLEmgq4A",
    resource_id: "rmY4LdeNlwB6RPN05CfJLEmgq4A",
    data: {
      address: {
        address_line_1: "St. Annes Gardens",
        country: "England",
        locality: "Lymington",
        postal_code: "SO41 9HT",
        premises: "6",
        region: "Hampshire",
      },
      appointed_on: "2014-03-31",
      country_of_residence: "England",
      date_of_birth: { month: 6, year: 1985 },
      links: {
        self: "/company/08967583/appointments/rmY4LdeNlwB6RPN05CfJLEmgq4A",
      },
      name: "WILSON, Stuart",
      nationality: "British",
      occupation: "Creative Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240368,
      published_at: "2021-08-20T13:36:05",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577256/appointments/4NjVivXcW7qsIMBrKo04XS2BSpw",
    resource_id: "4NjVivXcW7qsIMBrKo04XS2BSpw",
    data: {
      address: {
        address_line_1: "7-12 Tavistock Square",
        country: "United Kingdom",
        locality: "London",
        postal_code: "WC1H 9BQ",
        premises: "Lynton House",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "South Africa",
      date_of_birth: { month: 6, year: 1974 },
      links: {
        self: "/company/13577256/appointments/4NjVivXcW7qsIMBrKo04XS2BSpw",
      },
      name: "MATKOVICH, Anthony James",
      nationality: "South African",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240369,
      published_at: "2021-08-20T13:36:17",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577257/appointments/xf_5uAqTnrO5TCtCUF6jfv5y6lY",
    resource_id: "xf_5uAqTnrO5TCtCUF6jfv5y6lY",
    data: {
      address: {
        address_line_1: "Seaton Place",
        address_line_2: "Aztec Group House",
        country: "Jersey",
        locality: "St Helier",
        postal_code: "JE4 0QH",
        premises: "11-15",
      },
      appointed_on: "2021-08-20",
      identification: {
        identification_type: "other-corporate-body-or-firm",
        legal_authority: "JERSEY COMPANIES LAW",
        legal_form: "COMPANY",
        place_registered: "JERSEY",
        registration_number: "121547",
      },
      links: {
        self: "/company/13577257/appointments/xf_5uAqTnrO5TCtCUF6jfv5y6lY",
      },
      name: "AZTEC FINANCIAL SERVICES (JERSEY) LTD",
      officer_role: "corporate-secretary",
    },
    event: {
      timepoint: 2240370,
      published_at: "2021-08-20T13:36:08",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577254/appointments/odEIwt_JX4It66pjne2Y1CYe9Ds",
    resource_id: "odEIwt_JX4It66pjne2Y1CYe9Ds",
    data: {
      address: {
        address_line_1: "Wraysbury Drive",
        address_line_2: "Yiewsley",
        country: "England",
        locality: "West Drayton",
        postal_code: "UB7 7FR",
        premises: "106",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 10, year: 1977 },
      links: {
        self: "/company/13577254/appointments/odEIwt_JX4It66pjne2Y1CYe9Ds",
      },
      name: "RAHAD, Khaled",
      nationality: "British",
      occupation: "Business Person",
      officer_role: "director",
    },
    event: {
      timepoint: 2240371,
      published_at: "2021-08-20T13:36:24",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577257/appointments/eETWjyW1400Ur3YKPF3BQ3n_NtI",
    resource_id: "eETWjyW1400Ur3YKPF3BQ3n_NtI",
    data: {
      address: {
        address_line_1: "Grosvenor Gardens",
        country: "England",
        locality: "London",
        postal_code: "SW1W 0EB",
        premises: "42-44",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 4, year: 1964 },
      links: {
        self: "/company/13577257/appointments/eETWjyW1400Ur3YKPF3BQ3n_NtI",
      },
      name: "POWER, Charles Richard",
      nationality: "British",
      occupation: "Cfo",
      officer_role: "director",
    },
    event: {
      timepoint: 2240372,
      published_at: "2021-08-20T13:36:31",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/08077381/appointments/1iwpz0ZJahhlF43lvktkVBTUA2o",
    resource_id: "1iwpz0ZJahhlF43lvktkVBTUA2o",
    data: {
      address: {
        address_line_1: "Commerce Way",
        address_line_2: "Trafford Park",
        country: "England",
        locality: "Manchester",
        postal_code: "M17 1HW",
        premises: "Unit 15 Avocado Court",
      },
      appointed_on: "2012-05-21",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 9, year: 1960 },
      links: {
        self: "/company/08077381/appointments/1iwpz0ZJahhlF43lvktkVBTUA2o",
      },
      name: "ABBOTT, Nicholas Martin",
      nationality: "British",
      occupation: "Technical Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240373,
      published_at: "2021-08-20T13:37:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/08077381/appointments/L8HnInXdPyEu-gYKWXc6Nb7-zD0",
    resource_id: "L8HnInXdPyEu-gYKWXc6Nb7-zD0",
    data: {
      address: {
        address_line_1: "Commerce Way",
        address_line_2: "Trafford Park",
        country: "England",
        locality: "Manchester",
        postal_code: "M17 1HW",
        premises: "Unit 15 Avocado Court",
      },
      appointed_on: "2012-05-21",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 7, year: 1958 },
      links: {
        self: "/company/08077381/appointments/L8HnInXdPyEu-gYKWXc6Nb7-zD0",
      },
      name: "MILLS, Alexander Charles",
      nationality: "British",
      occupation: "Salesman",
      officer_role: "director",
    },
    event: {
      timepoint: 2240374,
      published_at: "2021-08-20T13:37:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/01448826/appointments/oH9eb__8eVnewdCpps9oyiXSKRM",
    resource_id: "oH9eb__8eVnewdCpps9oyiXSKRM",
    data: {
      address: {
        address_line_1: "137 Broad Road",
        locality: "Sale",
        postal_code: "M33 2EZ",
        region: "Cheshire",
      },
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 7, year: 1958 },
      links: {
        self: "/company/01448826/appointments/oH9eb__8eVnewdCpps9oyiXSKRM",
      },
      name: "MILLS, Alexander Charles",
      nationality: "British",
      occupation: "Salesman",
      officer_role: "director",
    },
    event: {
      timepoint: 2240375,
      published_at: "2021-08-20T13:37:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/07732319/appointments/kCzk9nKW_PHbPbF4Tww_iBPsDOw",
    resource_id: "kCzk9nKW_PHbPbF4Tww_iBPsDOw",
    data: {
      address: {
        address_line_1: "Brampton Road",
        locality: "Huntingdon",
        postal_code: "PE29 3BN",
        premises: "Hinchingbrooke School",
        region: "Cambridgeshire",
      },
      appointed_on: "2020-09-02",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1960 },
      links: {
        self: "/company/07732319/appointments/kCzk9nKW_PHbPbF4Tww_iBPsDOw",
      },
      name: "JOSHI, Raj",
      nationality: "British",
      occupation: "Barrister",
      officer_role: "director",
    },
    event: {
      timepoint: 2240376,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/06465714/appointments/Vui8MMm_OQsmKjBymr9PAg-AY_8",
    resource_id: "Vui8MMm_OQsmKjBymr9PAg-AY_8",
    data: {
      address: {
        country: "United Kingdom",
        locality: "Middlesbrough",
        postal_code: "TS1 3RF",
        premises: "192-194 Linthorpe Road",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 1, year: 1977 },
      links: {
        self: "/company/06465714/appointments/Vui8MMm_OQsmKjBymr9PAg-AY_8",
      },
      name: "AHMED, Mohammed Aslam",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240377,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/09516708/appointments/2ikQST-o7Im6kMkB_uOfh-Mivn0",
    resource_id: "2ikQST-o7Im6kMkB_uOfh-Mivn0",
    data: {
      address: {
        address_line_1: "South Cambridge Business Park",
        address_line_2: "Babraham Road, Sawston",
        country: "England",
        locality: "Cambridge",
        postal_code: "CB22 3JH",
        premises: "Unit D",
      },
      appointed_on: "2017-01-14",
      country_of_residence: "England",
      date_of_birth: { month: 6, year: 1978 },
      links: {
        self: "/company/09516708/appointments/2ikQST-o7Im6kMkB_uOfh-Mivn0",
      },
      name: "SAWFORD, Richard",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240378,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/07245346/appointments/3fs6inBWmSoYmNTs0pwSPnVwnCo",
    resource_id: "3fs6inBWmSoYmNTs0pwSPnVwnCo",
    data: {
      address: {
        address_line_1: "Links House",
        address_line_2: "Dundas Lane",
        country: "England",
        locality: "Portsmouth",
        postal_code: "PO3 5BL",
        premises: "Unit 5",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1974 },
      links: {
        self: "/company/07245346/appointments/3fs6inBWmSoYmNTs0pwSPnVwnCo",
      },
      name: "NORTH, Ian Andrew",
      nationality: "British",
      occupation: "Company Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240379,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/10594962/appointments/X9pA1ATAOsmGOE0F8z8tDOfqryo",
    resource_id: "X9pA1ATAOsmGOE0F8z8tDOfqryo",
    data: {
      address: {
        address_line_1: "33 Penfold Street",
        country: "England",
        locality: "London",
        postal_code: "NW8 8AY",
        premises: "Flat 19 Elmer House",
      },
      appointed_on: "2017-02-01",
      country_of_residence: "England",
      date_of_birth: { month: 4, year: 1953 },
      links: {
        self: "/company/10594962/appointments/X9pA1ATAOsmGOE0F8z8tDOfqryo",
      },
      name: "HAMZE, Ahmed",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240380,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/NI636189/appointments/DVlpLRgXRbn29WN4GuYnjGWIWMI",
    resource_id: "DVlpLRgXRbn29WN4GuYnjGWIWMI",
    data: {
      address: {
        address_line_1: "Ballynahinch Road",
        address_line_2: "Carryduff",
        country: "Northern Ireland",
        locality: "Belfast",
        postal_code: "BT8 8DN",
        premises: "Emerson House",
      },
      appointed_on: "2021-08-13",
      country_of_residence: "United States",
      date_of_birth: { month: 1, year: 1988 },
      links: {
        self: "/company/NI636189/appointments/DVlpLRgXRbn29WN4GuYnjGWIWMI",
      },
      name: "POTTER, Nick",
      nationality: "American",
      occupation: "Vice President, Private Equity",
      officer_role: "director",
    },
    event: {
      timepoint: 2240381,
      published_at: "2021-08-20T13:37:03",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577252/appointments/UtHdj3Zq7L7-uikraVA3jY6x6oo",
    resource_id: "UtHdj3Zq7L7-uikraVA3jY6x6oo",
    data: {
      address: {
        address_line_1: "Northgate Street",
        country: "Wales",
        locality: "Pembroke",
        postal_code: "SA71 4NR",
        premises: "6",
        region: "Pembrokeshire",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "Wales",
      date_of_birth: { month: 6, year: 1986 },
      links: {
        self: "/company/13577252/appointments/UtHdj3Zq7L7-uikraVA3jY6x6oo",
      },
      name: "GREEN, Alex Martyn",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240382,
      published_at: "2021-08-20T13:37:07",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577260/appointments/0YqUY562xgoxguzKJdG3evU5LBY",
    resource_id: "0YqUY562xgoxguzKJdG3evU5LBY",
    data: {
      address: {
        address_line_1: "Eastern Avenue",
        address_line_2: "Newbury Park",
        country: "United Kingdom",
        locality: "Ilford",
        postal_code: "IG2 7JD",
        premises: "962",
        region: "Essex",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1975 },
      links: {
        self: "/company/13577260/appointments/0YqUY562xgoxguzKJdG3evU5LBY",
      },
      name: "ZAHOOR, Abbas",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240383,
      published_at: "2021-08-20T13:37:07",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/13577269/appointments/XdYonB-clJfCUvmfF-D0Xfo53ko",
    resource_id: "XdYonB-clJfCUvmfF-D0Xfo53ko",
    data: {
      address: {
        address_line_1: "Westland Way",
        address_line_2: "Preston Farm Industrial Estate",
        country: "England",
        locality: "Stockton-On-Tees",
        postal_code: "TS18 3FB",
        premises: "1 Wylam Court",
      },
      appointed_on: "2021-08-20",
      country_of_residence: "England",
      date_of_birth: { month: 1, year: 1963 },
      links: {
        self: "/company/13577269/appointments/XdYonB-clJfCUvmfF-D0Xfo53ko",
      },
      name: "DICK, Callum Andrew John",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240384,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11782333/appointments/_WH3Qpwf_DM2JPfKy2lVCGJNMpY",
    resource_id: "_WH3Qpwf_DM2JPfKy2lVCGJNMpY",
    data: {
      address: {
        address_line_1: "Manor Park",
        country: "United Kingdom",
        locality: "Banbury",
        postal_code: "OX16 3TB",
        premises: "10",
      },
      appointed_on: "2019-01-23",
      country_of_residence: "United Kingdom",
      date_of_birth: { month: 12, year: 1989 },
      links: {
        self: "/company/11782333/appointments/_WH3Qpwf_DM2JPfKy2lVCGJNMpY",
      },
      name: "ALSOP-HALL, Charlotte Louise",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
      resigned_on: "2021-07-13",
    },
    event: {
      timepoint: 2240385,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11782333/appointments/XGEbRK9SLf2oBIAhznDhpBc5-Us",
    resource_id: "XGEbRK9SLf2oBIAhznDhpBc5-Us",
    data: {
      address: {
        address_line_1: "Manor Park",
        country: "United Kingdom",
        locality: "Banbury",
        postal_code: "OX16 3TB",
        premises: "10",
      },
      appointed_on: "2019-01-23",
      country_of_residence: "England",
      date_of_birth: { month: 1, year: 1992 },
      links: {
        self: "/company/11782333/appointments/XGEbRK9SLf2oBIAhznDhpBc5-Us",
      },
      name: "HINTON, Lauren Anne",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
      resigned_on: "2021-07-13",
    },
    event: {
      timepoint: 2240386,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11218666/appointments/GUSrauaLeyai_v3Q8nzHSPyV2Js",
    resource_id: "GUSrauaLeyai_v3Q8nzHSPyV2Js",
    data: {
      address: {
        address_line_1: "Howth Drive",
        address_line_2: "Woodley",
        country: "United Kingdom",
        locality: "Reading",
        postal_code: "RG5 3DJ",
        premises: "141",
      },
      appointed_on: "2020-08-21",
      country_of_residence: "England",
      date_of_birth: { month: 5, year: 1985 },
      links: {
        self: "/company/11218666/appointments/GUSrauaLeyai_v3Q8nzHSPyV2Js",
      },
      name: "PATEL, Raxitaben Bhupendrabhai",
      nationality: "Indian",
      occupation: "Quality Compliance Stability Lead",
      officer_role: "director",
    },
    event: {
      timepoint: 2240387,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
  {
    resource_kind: "company-officers",
    resource_uri: "/company/11029669/appointments/gX-b1xqklk6vzfD1D_hl7_t4Cmc",
    resource_id: "gX-b1xqklk6vzfD1D_hl7_t4Cmc",
    data: {
      address: {
        address_line_1: "Solar House",
        address_line_2: "915 High Road",
        country: "United Kingdom",
        locality: "London",
        postal_code: "N12 8QJ",
        premises: "C/O D & K Accountancy Services Limited",
      },
      appointed_on: "2017-10-24",
      country_of_residence: "England",
      date_of_birth: { month: 9, year: 1990 },
      links: {
        self: "/company/11029669/appointments/gX-b1xqklk6vzfD1D_hl7_t4Cmc",
      },
      name: "BOWER, Liam",
      nationality: "British",
      occupation: "Director",
      officer_role: "director",
    },
    event: {
      timepoint: 2240388,
      published_at: "2021-08-20T13:37:02",
      type: "changed",
    },
  },
]
