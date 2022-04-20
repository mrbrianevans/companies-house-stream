import { InsolvencyEvent } from "./types/eventTypes"
import { listenToStream, streamGenerator } from "./listenOnStream"

export const StreamInsolvencies = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(() => {
      io.emit(
        "event",
        sampleInsolvencyEvents[
          Math.floor(Math.random() * sampleInsolvencyEvents.length)
        ]
      )
      StreamInsolvencies(io, "test")
    }, Math.random() * 30000)
  } else {
    listenToStream<InsolvencyEvent.InsolvencyEvent>(
      "insolvency-cases",
      (event) => {
        io.emit("event", event)
      }
    )
    // for await(const event of streamGenerator('insolvency-cases'))
    //   io.emit('event', event)
  }
}

export async function AsyncStreamInsolvencies(io) {
  for await (const event of streamGenerator("insolvency-cases"))
    io.emit("event", event)
}

/**
 * Permanently reconnect to insolvency stream when stream ends
 */
export async function PermInsolvencies(io) {
  while (true) {
    await AsyncStreamInsolvencies(io)
  }
}

const sampleInsolvencyEvents: InsolvencyEvent.InsolvencyEvent[] = [
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10762530/insolvency",
    resource_id: "10762530",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-13",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-18", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1:
                  "Cowgill Holloway Business Recovery Llp Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
                region: "Lancashire",
              },
              appointed_on: "2021-01-18",
              name: "Craig Johns",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
              },
              appointed_on: "2021-01-18",
              name: "Jason Mark Elliott",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
              },
              appointed_on: "2021-01-18",
              name: "Nick Brierley",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "e03095ae12ae3465bdd9fde3b706432573bf80ea",
    },
    event: {
      timepoint: 568183,
      published_at: "2021-01-25T09:37:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10762530/insolvency",
    resource_id: "10762530",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-13",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-18", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1:
                  "Cowgill Holloway Business Recovery Llp Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
                region: "Lancashire",
              },
              appointed_on: "2021-01-18",
              name: "Craig Johns",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
              },
              appointed_on: "2021-01-18",
              name: "Jason Mark Elliott",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Regency House",
                address_line_2: "45-53 Chorley New Road",
                locality: "Bolton",
                postal_code: "BL1 4QR",
              },
              appointed_on: "2021-01-18",
              name: "Nick Brierley",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "60cfee9f3862fcde077648498f9c8511c5f0d58a",
    },
    event: {
      timepoint: 568182,
      published_at: "2021-01-25T09:37:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/08981025/insolvency",
    resource_id: "08981025",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2018-11-23",
              type: "declaration-solvent-on",
            },
            { date: "2018-11-28", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Leonard Curtis House Elms Square",
                address_line_2: "Bury New Road",
                locality: "Whitefield",
                postal_code: "M45 7TA",
                region: "Manchester",
              },
              appointed_on: "2018-11-28",
              name: "Steve Markey",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Leonard Curtis House Elms Square",
                address_line_2: "Bury New Road",
                locality: "Whitefield",
                postal_code: "M45 7TA",
                region: "Greater Manchester",
              },
              appointed_on: "2018-11-28",
              name: "Stuart Robb",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "fc9e21242292a08ea3f839e000dac2d2fc154474",
    },
    event: {
      timepoint: 568181,
      published_at: "2021-01-25T09:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/04271746/insolvency",
    resource_id: "04271746",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2014-06-17",
              type: "administration-started-on",
            },
            { date: "2015-12-31", type: "administration-ended-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "39 Castle Street",
                locality: "Leicester",
                postal_code: "LE1 5WN",
              },
              ceased_to_act_on: "2015-12-31",
              name: "Neil Charles Money",
              role: "practitioner",
            },
          ],
          type: "in-administration",
        },
        {
          dates: [{ date: "2015-12-31", type: "wound-up-on" }],
          number: "2",
          practitioners: [
            {
              address: {
                address_line_1: "39 Castle Street",
                locality: "Leicester",
                postal_code: "LE1 5WN",
              },
              appointed_on: "2015-12-31",
              name: "Neil Charles Money",
              role: "proposed-liquidator",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "b6fdf64254473c58cf85a73df19e10082516fa04",
    },
    event: {
      timepoint: 568180,
      published_at: "2021-01-25T09:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/04339700/insolvency",
    resource_id: "04339700",
    data: {
      cases: [
        {
          dates: [{ date: "2002-10-23", type: "instrumented-on" }],
          links: {
            charge: "/company/04339700/charges/iAmBk130ton2RloB0NI7EpZZg1c",
          },
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Grant Thornton Uk Llp",
                address_line_2: "Grant Thornton House",
                locality: "Melton Street",
                postal_code: "NW1 2EP",
                region: "Euston Square London",
              },
              appointed_on: "2005-03-07",
              ceased_to_act_on: "2013-11-28",
              name: "Martin Gilbert Ellis",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Grant Thornton",
                address_line_2: "Grant Thornton House",
                locality: "Melton Street, Euston Square",
                postal_code: "NW1 2EP",
                region: "London",
              },
              appointed_on: "2005-03-07",
              ceased_to_act_on: "2013-11-28",
              name: "Nigel Morrison",
              role: "practitioner",
            },
          ],
          type: "administrative-receiver",
        },
        {
          dates: [{ date: "2008-07-07", type: "wound-up-on" }],
          number: "2",
          practitioners: [
            {
              address: {
                address_line_1: "Pricewaterhousecoopers",
                address_line_2: "Hill House, Richmond Hill",
                locality: "Bournemouth",
                postal_code: "BH2 6HR",
              },
              appointed_on: "2008-07-07",
              name: "Michael John Andrew Jervis",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "33 Wellington Street",
                locality: "Leeds",
                postal_code: "LS1 4JP",
              },
              appointed_on: "2008-07-07",
              ceased_to_act_on: "2018-12-24",
              name: "Ian C. Oakley-Smith",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "One Reading Central 23 Forbury Road",
                locality: "Reading",
                region: "Berkshire",
              },
              appointed_on: "2018-12-24",
              name: "Rachael Wilkinson",
              role: "practitioner",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "5a8ef4103e550fcfe164e05f551aa4299fdb8c28",
    },
    event: {
      timepoint: 568179,
      published_at: "2021-01-25T09:36:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10762530/insolvency",
    resource_id: "10762530",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-13",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-18", type: "wound-up-on" },
          ],
          number: "1",
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "82f8387a2d77e968c8e647c7d04111ef20b9472d",
    },
    event: {
      timepoint: 568178,
      published_at: "2021-01-25T09:35:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/04914631/insolvency",
    resource_id: "04914631",
    data: {
      cases: [
        {
          dates: [{ date: "2015-11-16", type: "wound-up-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Wilkins Kennedy Llp Bridge House",
                address_line_2: "London Bridge",
                locality: "London",
                postal_code: "SE1 9QR",
              },
              appointed_on: "2018-11-26",
              name: "Stephen Paul Grant",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Wilkins Kennedy Llp 92 London Street",
                locality: "Reading",
                postal_code: "RG1 4SJ",
              },
              appointed_on: "2015-11-16",
              ceased_to_act_on: "2018-01-18",
              name: "John Arthur Kirkpatrick",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Wilkins Kennedy Llp",
                address_line_2: "92 London Street",
                locality: "Reading",
                postal_code: "RG1 4SJ",
                region: "Berkshire",
              },
              appointed_on: "2015-11-16",
              ceased_to_act_on: "2018-11-26",
              name: "David William Tann",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "92 London Street",
                locality: "Reading",
                postal_code: "RG1 4SJ",
                region: "Berkshire",
              },
              appointed_on: "2018-01-18",
              name: "Matthew John Waghorn",
              role: "practitioner",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "4533f98cfd623eff6a7aea3e4c69362575ef1fd7",
    },
    event: {
      timepoint: 568177,
      published_at: "2021-01-25T09:35:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/07974731/insolvency",
    resource_id: "07974731",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2019-11-28",
              type: "declaration-solvent-on",
            },
            { date: "2019-11-28", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "1st Floor 34 Falcon Court",
                address_line_2: "Preston Farm Business Park",
                locality: "Stockton On Tees",
                postal_code: "TS18 3TX",
              },
              appointed_on: "2019-11-28",
              name: "David Antony Willis",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "1st Floor 34 Falcon Court",
                address_line_2: "Preston Farm Business Park",
                locality: "Stockton On Tees",
                postal_code: "TS18 3TX",
                region: "Cleveland",
              },
              appointed_on: "2019-11-28",
              name: "Martyn James Pullin",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "14b97c7b2a9aaf3b5e71bc4d0b6ed41f07107399",
    },
    event: {
      timepoint: 568176,
      published_at: "2021-01-25T09:34:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/02444970/insolvency",
    resource_id: "02444970",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2000-12-27",
              type: "declaration-solvent-on",
            },
            { date: "2000-12-28", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Pricewaterhousecoopers",
                address_line_2: "Plumtree Court",
                locality: "London",
                postal_code: "EC4A 4HT",
              },
              appointed_on: "2000-12-28",
              ceased_to_act_on: "2002-06-20",
              name: "Colin Bird",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Pricewaterhousecoopers Llp",
                address_line_2: "Plumtree Court",
                locality: "London",
                postal_code: "EC4A 4HT",
              },
              appointed_on: "2000-12-28",
              ceased_to_act_on: "2014-03-19",
              name: "Richard Victor Yerburgh Setchim",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Plumtree Court",
                locality: "London",
                postal_code: "EC4A 4HT",
              },
              appointed_on: "2002-06-20",
              ceased_to_act_on: "2017-07-03",
              name: "Timothy Gerard Walsh",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "7 More London Riverside",
                locality: "London",
                postal_code: "SE1 2RT",
              },
              appointed_on: "2017-07-03",
              name: "Laura May Waters",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Pricewaterhousecoopers Llp",
                address_line_2: "7 More London Riverside",
                locality: "London",
                postal_code: "SE1 2RT",
              },
              appointed_on: "2017-07-03",
              name: "Robert Nicholas Lewis",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "7 More London Riverside",
                locality: "London",
                postal_code: "SE1 2RT",
              },
              appointed_on: "2014-03-19",
              ceased_to_act_on: "2017-07-03",
              name: "Peter James Greaves",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "bc38765c46e771655cd67651e672f396d8b8be6e",
    },
    event: {
      timepoint: 568175,
      published_at: "2021-01-25T09:34:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10762530/insolvency",
    resource_id: "10762530",
    data: {
      cases: [
        {
          dates: [{ date: "2021-01-13", type: "declaration-solvent-on" }],
          number: "1",
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "fd010bf49d93673388d2c2c4b636bf4115ad0da4",
    },
    event: {
      timepoint: 568174,
      published_at: "2021-01-25T09:34:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/12325716/insolvency",
    resource_id: "12325716",
    data: {
      cases: [{ number: "1", type: "creditors-voluntary-liquidation" }],
      etag: "251ee978ccb877192efdf24683e0e4613e4ca0b0",
    },
    event: {
      timepoint: 568173,
      published_at: "2021-01-25T09:32:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/09686507/insolvency",
    resource_id: "09686507",
    data: {
      cases: [
        {
          dates: [{ date: "2019-09-23", type: "wound-up-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Greenfield Recovery Limited Trinity House",
                address_line_2: "28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2020-07-14",
              name: "Simon Matthew Gwinnutt",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Trinity House  28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2019-09-23",
              ceased_to_act_on: "2020-07-14",
              name: "Philip Ballard",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Trinity House",
                address_line_2: "28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2019-09-23",
              name: "Sajid Sattar",
              role: "practitioner",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "9172701aabd7f7de2dfd526b0c5a9763b6a1bcc6",
    },
    event: {
      timepoint: 568185,
      published_at: "2021-01-25T09:39:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10962870/insolvency",
    resource_id: "10962870",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-06",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-06", type: "wound-up-on" },
          ],
          number: "1",
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "7911db4644ce1e1b9f101c390bc7f6824095d2d4",
    },
    event: {
      timepoint: 568186,
      published_at: "2021-01-25T09:39:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/03896740/insolvency",
    resource_id: "03896740",
    data: {
      cases: [
        {
          dates: [{ date: "2021-01-18", type: "wound-up-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "The Old Library The Walk",
                address_line_2: "Winslow",
                locality: "Buckingham",
                postal_code: "MK18 3AJ",
                region: "Buckinghamshire",
              },
              appointed_on: "2021-01-18",
              name: "Lee James Cotton",
              role: "practitioner",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "eaee1aea2b0fd7937f9906941adade5bee46c701",
    },
    event: {
      timepoint: 568187,
      published_at: "2021-01-25T09:41:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10962870/insolvency",
    resource_id: "10962870",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-06",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-06", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "3rd Floor The Pinnacle 73 King Street",
                locality: "Manchester",
                postal_code: "M2 4NG",
              },
              appointed_on: "2021-01-06",
              name: "Toyah Marie Poole",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "3rd Floor The Pinnacle",
                address_line_2: "73 King Street",
                locality: "Manchester",
                postal_code: "M2 4NG",
              },
              appointed_on: "2021-01-06",
              name: "John Paul Bell",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "f5b649dfe56b46266000002e15ddc377e464d875",
    },
    event: {
      timepoint: 568189,
      published_at: "2021-01-25T09:41:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/10962870/insolvency",
    resource_id: "10962870",
    data: {
      cases: [
        {
          dates: [
            {
              date: "2021-01-06",
              type: "declaration-solvent-on",
            },
            { date: "2021-01-06", type: "wound-up-on" },
          ],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "3rd Floor The Pinnacle 73 King Street",
                locality: "Manchester",
                postal_code: "M2 4NG",
              },
              appointed_on: "2021-01-06",
              name: "Toyah Marie Poole",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "3rd Floor The Pinnacle",
                address_line_2: "73 King Street",
                locality: "Manchester",
                postal_code: "M2 4NG",
              },
              appointed_on: "2021-01-06",
              name: "John Paul Bell",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "4b1bd651d9c60d3a3b2d9012aaa9fbe0cb5fa9d6",
    },
    event: {
      timepoint: 568190,
      published_at: "2021-01-25T09:41:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/07681347/insolvency",
    resource_id: "07681347",
    data: {
      cases: [
        {
          dates: [{ date: "2020-01-17", type: "administration-started-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "15 Westferry Circus",
                address_line_2: "Canary Wharf",
                locality: "London",
                postal_code: "E14 4HD",
              },
              name: "Stephen Goderski",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Geoffrey Martin & Co 15 Westferry Circus",
                address_line_2: "Canary Wharf",
                locality: "London",
                postal_code: "E14 4HD",
              },
              name: "Peter Hart",
              role: "practitioner",
            },
          ],
          type: "in-administration",
        },
      ],
      etag: "dfde96a1dc647d48b8adc52a1ed2e0c24829aeec",
    },
    event: {
      timepoint: 568191,
      published_at: "2021-01-25T09:43:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/09040919/insolvency",
    resource_id: "09040919",
    data: {
      cases: [
        {
          dates: [{ date: "2019-09-23", type: "wound-up-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Greenfield Recovery Limited Trinity House",
                address_line_2: "28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2020-07-14",
              name: "Simon Matthew Gwinnutt",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Trinity House",
                address_line_2: "28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2019-09-23",
              name: "Sajid Sattar",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "Trinity House  28-30 Blucher Street",
                locality: "Birmingham",
                postal_code: "B1 1QH",
              },
              appointed_on: "2019-09-23",
              ceased_to_act_on: "2020-07-14",
              name: "Philip Ballard",
              role: "practitioner",
            },
          ],
          type: "creditors-voluntary-liquidation",
        },
      ],
      etag: "0f017b5a390bf07dab2f427c2e5c61ba3d7854b0",
    },
    event: {
      timepoint: 568192,
      published_at: "2021-01-25T09:43:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/01279856/insolvency",
    resource_id: "01279856",
    data: {
      cases: [
        {
          dates: [{ date: "2020-12-18", type: "declaration-solvent-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Jeremy Knight & Co 68 Ship Street",
                locality: "Brighton",
                postal_code: "BN1 1AE",
                region: "East Sussex",
              },
              appointed_on: "2021-01-11",
              name: "William Jeremy Jonathan Knight",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "68 Ship Street",
                locality: "Brighton",
                postal_code: "BN1 1AE",
                region: "East Sussex",
              },
              appointed_on: "2021-01-11",
              name: "Simon Peter Edward Knight",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "2445b4a187411f2f8b7518981872920bf17797fb",
    },
    event: {
      timepoint: 568193,
      published_at: "2021-01-25T09:44:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/09020390/insolvency",
    resource_id: "09020390",
    data: {
      cases: [
        {
          dates: [{ date: "2020-06-24", type: "administration-started-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "15 Canada Square",
                address_line_2: "Canary Wharf",
                locality: "London",
                postal_code: "E14 5GL",
              },
              name: "James Robert Tucker",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "15 Canada Square",
                address_line_2: "Canary Wharf",
                locality: "London",
                postal_code: "E14 5GL",
              },
              name: "David John Pike",
              role: "practitioner",
            },
          ],
          type: "in-administration",
        },
      ],
      etag: "92a55a08f242884ad1114939b0f3b26577939965",
    },
    event: {
      timepoint: 568194,
      published_at: "2021-01-25T09:44:01",
      type: "changed",
    },
  },
  {
    resource_kind: "company-insolvency",
    resource_uri: "/company/01279856/insolvency",
    resource_id: "01279856",
    data: {
      cases: [
        {
          dates: [{ date: "2020-12-18", type: "declaration-solvent-on" }],
          number: "1",
          practitioners: [
            {
              address: {
                address_line_1: "Jeremy Knight & Co 68 Ship Street",
                locality: "Brighton",
                postal_code: "BN1 1AE",
                region: "East Sussex",
              },
              appointed_on: "2021-01-11",
              name: "William Jeremy Jonathan Knight",
              role: "practitioner",
            },
            {
              address: {
                address_line_1: "68 Ship Street",
                locality: "Brighton",
                postal_code: "BN1 1AE",
                region: "East Sussex",
              },
              appointed_on: "2021-01-11",
              name: "Simon Peter Edward Knight",
              role: "practitioner",
            },
          ],
          type: "members-voluntary-liquidation",
        },
      ],
      etag: "2445b4a187411f2f8b7518981872920bf17797fb",
    },
    event: {
      timepoint: 568195,
      published_at: "2021-01-25T09:44:01",
      type: "changed",
    },
  },
]
