import * as request from "request";
import {InsolvencyEvent} from "../eventTypes";
import * as faker from 'faker'

export const StreamInsolvencies = (io, mode: 'test' | 'live') => {
  if (mode == "test") {
    // setInterval(()=>io.emit("heartbeat", {}), Math.random()*20000)
    // setInterval(()=>console.log("insolvency heartbeat"), Math.random()*20000)
    //faker:
    setTimeout(() => {
      io.emit('event', {
        "resource_kind": "insolvency-case",
        "resource_uri": "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4",
        "resource_id": "MzI4OTQzODc5MGFkaXF6a2N4",
        "data": {
          "barcode": "X9WQX0NE",
          "category": "accounts",
          "date": "2021-01-22",
          "description": "accounts-with-accounts-type-micro-entity",
          "description_values": {
            "made_up_date": "2020-03-31"
          },
          "links": {
            "self": "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4"
          },
          "transaction_id": "MzI4OTQzODc5MGFkaXF6a2N4",
          "type": "AA"
        },
        "event": {
          "timepoint": 48990574,
          "published_at": "2021-01-22T18:28:02",
          "type": faker.random.arrayElement(['changed', 'deleted'])
        }
      })
      StreamInsolvencies(io, 'test')
    }, Math.random() * 30000)
  } else {
    let dataBuffer = ''
    const reqStream = request.get('https://stream.companieshouse.gov.uk/insolvency-cases')
        .auth(process.env.APIUSER, '')
        .on('response', (r: any) => {
          console.log("Headers received, status", r.statusCode)
          switch (r.statusCode) {
            case 200:
              console.log("Listening to updates on insolvency stream")
              break;
            case 416:
              console.log("Timepoint out of date")
              break;
            case 429:
              console.log("RATE LIMITED, exiting now")
              process.exit()
              break;
            default:
              process.exit()
          }
        })
        .on('error', (e: any) => console.error('error', e))
        .on('data', async (d: any) => {
          if (d.toString().length > 1) {
            reqStream.pause()

            dataBuffer += d.toString('utf8')
            while (dataBuffer.includes('\n')) {
              let newLinePosition = dataBuffer.search('\n')
              let jsonText = dataBuffer.slice(0, newLinePosition)
              dataBuffer = dataBuffer.slice(newLinePosition + 1)
              try {
                let jsonObject: InsolvencyEvent.InsolvencyEvent = JSON.parse(jsonText)
                io.emit('event', jsonObject)
                console.log("INSOLVENCY EVENT!!")
                console.log(JSON.stringify(jsonObject))
              } catch (e) {
                console.error(`\x1b[31mCOULD NOT PARSE insolvency: \x1b[0m*${jsonText}*`)
              }
            }
            reqStream.resume()
          } else {
            io.emit('heartbeat', {})
          }
        })
        .on('end', () => console.error("Insolvency stream ended"))
  }
}
