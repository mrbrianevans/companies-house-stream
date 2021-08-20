import * as request from "request";
import { getMongoClient } from "./getMongoClient";
import { MongoError } from "mongodb";
import * as logger from "node-color-log";
import { getCompanyInfo } from "./getCompanyInfo";
const TARGET_QUEUE_SIZE = 20
const MIN_DELAY = 200 //ms
export const StreamPsc = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(() => {
      io.emit(
        "event",
        samplePscEvents[
          Math.floor(Math.random() * samplePscEvents.length)
          ]
      );
      StreamPsc(io, "test");
    }, Math.random() * 15000);
  } else {
	  let queue = []
    let dataBuffer = "";
    const reqStream = request
      .get("https://stream.companieshouse.gov.uk/persons-with-significant-control")
      .auth(process.env.APIUSER, "")
      .on("response", (r: any) => {
        console.log("psc Headers received, status", r.statusCode);
        switch (r.statusCode) {
          case 200:
            console.log("Listening to updates on psc stream");
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
            let newLinePosition = dataBuffer.search("\n");
            let jsonText = dataBuffer.slice(0, newLinePosition);
            dataBuffer = dataBuffer.slice(newLinePosition + 1);
            if (jsonText.length === 0) continue;
            try {
              let jsonObject = JSON.parse(jsonText);
			  const [, companyNumber] = jsonObject.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/persons-with-significant-control/)
			  // save event in mongo db
              const client = await getMongoClient();
              try {
                await client
                  .db("events")
                  .collection("psc_events")
                  .insertOne({
                    _id: jsonObject.resource_id,
                    ...jsonObject
                  }).then(async () => {
                    // make sure company is in postgres otherwise put in not_found
                    const companyProfile = await getCompanyInfo(companyNumber);
                    // queue event because its not a duplicate, send company profile with event
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
              console.error(
                `\x1b[31mCOULD NOT PARSE psc: \x1b[0m*${jsonText}*`
              );
            }
          }
          reqStream.resume();
        } else {
          io.emit("heartbeat", {});
        }
      })
      .on("end", () => {
        console.error("psc stream ended");
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
		  setTimeout(releaseEvent, delay)
	  }
	  releaseEvent()
	  
 }
};

const samplePscEvents = [
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577355/persons-with-significant-control/individual/8B2GSDdl3xlsFi7Q6wVWdYmTpfE',
  resource_id: '8B2GSDdl3xlsFi7Q6wVWdYmTpfE',
  data: {
    address: {
      address_line_1: '2 Bicycle Mews',
      country: 'United Kingdom',
      locality: 'London',
      postal_code: 'SW4 6FE',
      premises: 'Suite 9'
    },
    country_of_residence: 'Italy',
    date_of_birth: { month: 11, year: 1989 },
    etag: '65d63b48898d4b2e70673f29a2e0f4f45103d9b1',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577355/persons-with-significant-control/individual/8B2GSDdl3xlsFi7Q6wVWdYmTpfE'
    },
    name: 'Giuseppe Eros Lana',
    name_elements: { forename: 'Giuseppe', surname: 'Lana' },
    nationality: 'Italian',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350506,
    published_at: '2021-08-20T13:58:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577354/persons-with-significant-control/individual/TVmg2EQBpIoPoXWWqnazMCPl6Wo',
  resource_id: 'TVmg2EQBpIoPoXWWqnazMCPl6Wo',
  data: {
    address: {
      address_line_1: 'Staines  Road',
      country: 'United Kingdom',
      locality: 'Feltham',
      postal_code: 'TW14 0JT',
      premises: '38'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 10, year: 1992 },
    etag: '1807f0aba050e5d34999ed34d3ed3b6169a33c8d',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577354/persons-with-significant-control/individual/TVmg2EQBpIoPoXWWqnazMCPl6Wo'
    },
    name: 'Mr Raby Nadeem',
    name_elements: { forename: 'Raby', surname: 'Nadeem', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350507,
    published_at: '2021-08-20T13:58:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/SC329345/persons-with-significant-control/individual/Dq6qFsRrEjWBoaTMkoMi8tT_rt8',
  resource_id: 'Dq6qFsRrEjWBoaTMkoMi8tT_rt8',
  data: {
    address: {
      address_line_1: 'Prime Four Business Park',
      address_line_2: 'Kingswells',
      locality: 'Aberdeen',
      postal_code: 'AB15 8PU',
      premises: 'Kingshill View'
    },
    ceased_on: '2021-08-19',
    country_of_residence: 'Scotland',
    date_of_birth: { month: 6, year: 1968 },
    etag: '57d9285dd3736b8d91ccd7373a02b25ca3806e5c',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/SC329345/persons-with-significant-control/individual/Dq6qFsRrEjWBoaTMkoMi8tT_rt8'
    },
    name: 'Mr Richard George Kilcullen',
    name_elements: { forename: 'Richard', surname: 'Kilcullen', title: 'Mr' },
    nationality: 'Scottish',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors',
      'significant-influence-or-control'
    ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350854,
    published_at: '2021-08-20T14:30:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/02669295/persons-with-significant-control/individual/B4sChzjCnG7iI2omK7jwjXlZH9M',
  resource_id: 'B4sChzjCnG7iI2omK7jwjXlZH9M',
  data: {
    address: {
      address_line_1: 'Bishops Orchard',
      address_line_2: 'East Hagbourne',
      country: 'England',
      locality: 'Didcot',
      postal_code: 'OX11 9JS',
      premises: '20'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 3, year: 1983 },
    etag: 'ebfeac2c0564b4afbd823b2c0fed5d71169f706c',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/02669295/persons-with-significant-control/individual/B4sChzjCnG7iI2omK7jwjXlZH9M'
    },
    name: 'Mr Alexander Simon Kay',
    name_elements: { forename: 'Alexander', surname: 'Kay', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350855,
    published_at: '2021-08-20T14:30:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/03602787/persons-with-significant-control/individual/y04qyM3ZvQhmguggYCYO2S97EqM',
  resource_id: 'y04qyM3ZvQhmguggYCYO2S97EqM',
  data: {
    address: {
      address_line_1: '340 The Highway',
      country: 'United Kingdom',
      locality: 'London',
      premises: '9 Free Trade Warf',
      region: 'E1w 3es'
    },
    ceased_on: '2016-04-06',
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 6, year: 1959 },
    etag: '54ca0eb26ce5580c71a8b84685074f49cfed6315',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/03602787/persons-with-significant-control/individual/y04qyM3ZvQhmguggYCYO2S97EqM'
    },
    name: 'Ms Judy Anne Delaforce',
    name_elements: { forename: 'Judy', surname: 'Delaforce', title: 'Ms' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350856,
    published_at: '2021-08-20T14:30:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/10202440/persons-with-significant-control/individual/PBFTciIE91djDMINRp7IC-0hFVY',
  resource_id: 'PBFTciIE91djDMINRp7IC-0hFVY',
  data: {
    address: {
      address_line_1: '58-60 Kensington Church Street',
      country: 'England',
      locality: 'London',
      postal_code: 'W8 4DB',
      premises: 'Unit 7, Antique Centre'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 1976 },
    etag: 'd1a7c856897371442abdf4cab3745b33b78c6e9a',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/10202440/persons-with-significant-control/individual/PBFTciIE91djDMINRp7IC-0hFVY'
    },
    name: 'Ms Zhuohan Zhang',
    name_elements: { forename: 'Zhuohan', surname: 'Zhang', title: 'Ms' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2016-05-26'
  },
  event: {
    timepoint: 1350857,
    published_at: '2021-08-20T14:30:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/10512472/persons-with-significant-control/individual/mg5TPivc0I9Kqfz-in004cBfpyw',
  resource_id: 'mg5TPivc0I9Kqfz-in004cBfpyw',
  data: {
    address: {
      address_line_1: 'Audrey Road',
      country: 'England',
      locality: 'Sheffield',
      postal_code: 'S13 8DR',
      premises: '22'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 5, year: 1945 },
    etag: '4f44bce9dfa0af3bbc6b6d435e14306911ad4476',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/10512472/persons-with-significant-control/individual/mg5TPivc0I9Kqfz-in004cBfpyw'
    },
    name: 'Mrs Margaret Jane Ruth Elton',
    name_elements: { forename: 'Margaret', surname: 'Elton', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2016-12-06'
  },
  event: {
    timepoint: 1350858,
    published_at: '2021-08-20T14:30:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11769131/persons-with-significant-control/individual/XWBKPnSene3xxHi_k9p3x_YJvug',
  resource_id: 'XWBKPnSene3xxHi_k9p3x_YJvug',
  data: {
    address: {
      address_line_1: 'Brulimar House Jubilee Road',
      country: 'United Kingdom',
      locality: 'Middleton, Manchester,',
      postal_code: 'M24 2LX',
      premises: 'G.A. Harris'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 1, year: 1991 },
    etag: '1d8bc99c5f68c9e16da2baeb9083e686d48c0960',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11769131/persons-with-significant-control/individual/XWBKPnSene3xxHi_k9p3x_YJvug'
    },
    name: 'Mr Jakob Grunwald',
    name_elements: { forename: 'Jakob', surname: 'Grunwald', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2019-01-16'
  },
  event: {
    timepoint: 1350859,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/10474711/persons-with-significant-control/individual/BrNr9AJLgcUajowPV8hTawtY6AA',
  resource_id: 'BrNr9AJLgcUajowPV8hTawtY6AA',
  data: {
    address: {
      address_line_1: '107 Cheapside',
      locality: 'London',
      postal_code: 'EC2V 6DN',
      premises: '9th Floor'
    },
    ceased_on: '2019-05-21',
    country_of_residence: 'Serbia',
    date_of_birth: { month: 2, year: 1985 },
    etag: 'a29530779333f2f6b5f46a3890cdc85258b81504',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/10474711/persons-with-significant-control/individual/BrNr9AJLgcUajowPV8hTawtY6AA'
    },
    name: 'Mr Misa Zivic',
    name_elements: { forename: 'Misa', surname: 'Zivic', title: 'Mr' },
    nationality: 'Serbian',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2016-11-11'
  },
  event: {
    timepoint: 1350860,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13220928/persons-with-significant-control/individual/djssvse8Go14J6aPDc5JawqTsmI',
  resource_id: 'djssvse8Go14J6aPDc5JawqTsmI',
  data: {
    address: {
      address_line_1: 'Brulimar House Jubilee Road',
      country: 'United Kingdom',
      locality: 'Middleton, Manchester',
      postal_code: 'M24 2LX',
      premises: 'G.A. Harris'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 1, year: 1991 },
    etag: 'd27f9cdd29377ad40256532cc57e59a11fbac37a',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13220928/persons-with-significant-control/individual/djssvse8Go14J6aPDc5JawqTsmI'
    },
    name: 'Mr Jakob Grunwald',
    name_elements: { forename: 'Jakob', surname: 'Grunwald', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-02-24'
  },
  event: {
    timepoint: 1350861,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/05382251/persons-with-significant-control/individual/30V9K2vKd8o_n015Sl5HU4cdT3c',
  resource_id: '30V9K2vKd8o_n015Sl5HU4cdT3c',
  data: {
    address: {
      address_line_1: 'Eassa Hussain Ali Yousaf',
      address_line_2: 'Al Majaz Adea',
      country: 'Uae',
      locality: 'Sharjah',
      premises: '501'
    },
    country_of_residence: 'United Arab Emirates',
    date_of_birth: { month: 8, year: 1962 },
    etag: '78dd03c162fb8294987777c78f350dcaae317390',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/05382251/persons-with-significant-control/individual/30V9K2vKd8o_n015Sl5HU4cdT3c'
    },
    name: 'Mr Sanjiv Khanna',
    name_elements: { forename: 'Sanjiv', surname: 'Khanna', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2017-02-28'
  },
  event: {
    timepoint: 1350862,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/12843629/persons-with-significant-control/individual/cvbTmhhGb-lTqFQ7Z-XBc1Nz2yI',
  resource_id: 'cvbTmhhGb-lTqFQ7Z-XBc1Nz2yI',
  data: {
    address: {
      address_line_1: 'Brulimar House Jubilee Road',
      country: 'United Kingdom',
      locality: 'Middleton, Manchester',
      postal_code: 'M24 2LX',
      premises: 'G.A. Harris'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 1, year: 1991 },
    etag: '02a895ddba45aa91e3f09a3cfa69b065c09c8199',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/12843629/persons-with-significant-control/individual/cvbTmhhGb-lTqFQ7Z-XBc1Nz2yI'
    },
    name: 'Mr Jakob Grunwald',
    name_elements: { forename: 'Jakob', surname: 'Grunwald', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2020-08-28'
  },
  event: {
    timepoint: 1350863,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/09616242/persons-with-significant-control/individual/5SKKgYSU4daPcdz_Qw4SIivODYM',
  resource_id: '5SKKgYSU4daPcdz_Qw4SIivODYM',
  data: {
    address: {
      address_line_1: 'Turners Hill',
      country: 'United Kingdom',
      locality: 'Cheshunt',
      postal_code: 'EN8 9BH',
      premises: '167',
      region: 'Hertfordshire'
    },
    country_of_residence: 'Greece',
    date_of_birth: { month: 4, year: 1992 },
    etag: '3f2b74f4feda6b05a846c30a2ebee576ea6900d6',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/09616242/persons-with-significant-control/individual/5SKKgYSU4daPcdz_Qw4SIivODYM'
    },
    name: 'Ms Elena Gavriela Karavasili',
    name_elements: { forename: 'Elena', surname: 'Karavasili', title: 'Ms' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2016-06-30'
  },
  event: {
    timepoint: 1350864,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/10474711/persons-with-significant-control/individual/7UVDjH9lxb9752TUtGH8CX0Zwzg',
  resource_id: '7UVDjH9lxb9752TUtGH8CX0Zwzg',
  data: {
    address: {
      address_line_1: '107 Cheapside',
      locality: 'London',
      postal_code: 'EC2V 6DN',
      premises: '9th Floor'
    },
    ceased_on: '2019-05-21',
    country_of_residence: 'Macedonia (Fyr)',
    date_of_birth: { month: 4, year: 1987 },
    etag: '74cb0c1d6d944d9fbf49fda063dc2a80ac25b7de',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/10474711/persons-with-significant-control/individual/7UVDjH9lxb9752TUtGH8CX0Zwzg'
    },
    name: 'Dushan Neshovski',
    name_elements: { forename: 'Dushan', surname: 'Neshovski' },
    nationality: 'Macedonian',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2016-11-11'
  },
  event: {
    timepoint: 1350865,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11953938/persons-with-significant-control/individual/bRXu9kforR6mEvwoTMhbiwHMFLE',
  resource_id: 'bRXu9kforR6mEvwoTMhbiwHMFLE',
  data: {
    address: {
      address_line_1: 'Arbour Lane',
      country: 'United Kingdom',
      locality: 'Chelmsford',
      postal_code: 'CM1 7RL',
      premises: '82',
      region: 'Essex'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 8, year: 1985 },
    etag: 'df8817ce634c05f92b1eec686c485b151157bb21',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11953938/persons-with-significant-control/individual/bRXu9kforR6mEvwoTMhbiwHMFLE'
    },
    name: 'Mr Ricky Lee',
    name_elements: { forename: 'Ricky', surname: 'Lee', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'significant-influence-or-control' ],
    notified_on: '2021-07-01'
  },
  event: {
    timepoint: 1350866,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13537539/persons-with-significant-control/individual/3rj4F-mdlDgKtkXbmCV3eBXUc2k',
  resource_id: '3rj4F-mdlDgKtkXbmCV3eBXUc2k',
  data: {
    address: {
      address_line_1: 'Mill Court',
      address_line_2: 'Great Shelford',
      country: 'United Kingdom',
      locality: 'Cambridge',
      postal_code: 'CB22 5LD',
      premises: 'Quern House',
      region: 'Cambridgeshire'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 9, year: 1983 },
    etag: '1e47e7cafb5ae8c5365371f02835c145613ddf18',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13537539/persons-with-significant-control/individual/3rj4F-mdlDgKtkXbmCV3eBXUc2k'
    },
    name: 'Mrs Sadaf Ataei-Khoshro',
    name_elements: { forename: 'Sadaf', surname: 'Ataei-Khoshro', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2021-07-29'
  },
  event: {
    timepoint: 1350867,
    published_at: '2021-08-20T14:31:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/SC329345/persons-with-significant-control/individual/z8uxmYdzJiNuKvf8C6rjDJermrU',
  resource_id: 'z8uxmYdzJiNuKvf8C6rjDJermrU',
  data: {
    address: {
      address_line_1: 'Prime Four Business Park',
      address_line_2: 'Kingswells',
      locality: 'Aberdeen',
      postal_code: 'AB15 8PU',
      premises: 'Kingshill View'
    },
    ceased_on: '2021-08-19',
    country_of_residence: 'Scotland',
    date_of_birth: { month: 3, year: 1969 },
    etag: '0122468f5ffa2a86a13076acee9551cfcfd666e0',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/SC329345/persons-with-significant-control/individual/z8uxmYdzJiNuKvf8C6rjDJermrU'
    },
    name: 'Mr Athole Mcdonald',
    name_elements: { forename: 'Athole', surname: 'Mcdonald', title: 'Mr' },
    nationality: 'Scottish',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors',
      'significant-influence-or-control'
    ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350868,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13179194/persons-with-significant-control/individual/nj0Myq5SvYiCMeGd_PtzEoELxR4',
  resource_id: 'nj0Myq5SvYiCMeGd_PtzEoELxR4',
  data: {
    address: {
      address_line_1: 'Mill Court',
      address_line_2: 'Great Shelford',
      country: 'United Kingdom',
      locality: 'Cambridge',
      postal_code: 'CB22 5LD',
      premises: '4 Quern House',
      region: 'Cambridgeshire'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 9, year: 1983 },
    etag: 'bfd7997b4a482f5520e20b75dfd72a712228f72b',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13179194/persons-with-significant-control/individual/nj0Myq5SvYiCMeGd_PtzEoELxR4'
    },
    name: 'Mrs Sadaf Ataei-Khoshro',
    name_elements: { forename: 'Sadaf', surname: 'Ataei-Khoshro', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-02-04'
  },
  event: {
    timepoint: 1350869,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/05382251/persons-with-significant-control/individual/30V9K2vKd8o_n015Sl5HU4cdT3c',
  resource_id: '30V9K2vKd8o_n015Sl5HU4cdT3c',
  data: {
    address: {
      address_line_1: 'Eassa Hussain Ali Yousaf',
      address_line_2: 'Al Majaz Adea',
      country: 'Uae',
      locality: 'Sharjah',
      premises: '501'
    },
    country_of_residence: 'United Arab Emirates',
    date_of_birth: { month: 8, year: 1962 },
    etag: '16f755791a4a4f389987ea5757fc825367b83bff',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/05382251/persons-with-significant-control/individual/30V9K2vKd8o_n015Sl5HU4cdT3c'
    },
    name: 'Mr Sanjiv Khanna',
    name_elements: { forename: 'Sanjiv', surname: 'Khanna', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2017-02-28'
  },
  event: {
    timepoint: 1350870,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13323345/persons-with-significant-control/individual/EKTWBDWDg27_qDyhnaaF4lEbzao',
  resource_id: 'EKTWBDWDg27_qDyhnaaF4lEbzao',
  data: {
    address: {
      address_line_1: '40 Rodney Street',
      country: 'England',
      locality: 'Liverpool',
      postal_code: 'L1 9AA',
      premises: 'Rodney Chambers'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 1988 },
    etag: 'f14e34b48829834a8c09b09d180ac4a2d3eed412',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13323345/persons-with-significant-control/individual/EKTWBDWDg27_qDyhnaaF4lEbzao'
    },
    name: 'Mr Paul Murray',
    name_elements: { forename: 'Paul', surname: 'Murray', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-04-08'
  },
  event: {
    timepoint: 1350871,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-corporate',
  resource_uri: '/company/03620144/persons-with-significant-control/corporate-entity/7I70UvON5_CScQsoU-oUyURmA90',
  resource_id: '7I70UvON5_CScQsoU-oUyURmA90',
  data: {
    address: {
      address_line_1: '27 Bath Road',
      country: 'England',
      locality: 'Cheltenham',
      postal_code: 'GL53 7TH',
      premises: 'Delta Place'
    },
    etag: '046cb58c112cb38da773e3e35efb4b04e3b109ae',
    identification: {
      country_registered: 'England',
      legal_authority: 'Companies Act 2006',
      legal_form: 'Limited Company',
      place_registered: 'Registrar Of England And Wales',
      registration_number: '10836542'
    },
    kind: 'corporate-entity-person-with-significant-control',
    links: {
      self: '/company/03620144/persons-with-significant-control/corporate-entity/7I70UvON5_CScQsoU-oUyURmA90'
    },
    name: 'Peninsula Sand Holdings Limited',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2017-08-17'
  },
  event: {
    timepoint: 1350872,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/07551943/persons-with-significant-control/individual/TZBc5LJoJQrz59Ick90D5WRMCkQ',
  resource_id: 'TZBc5LJoJQrz59Ick90D5WRMCkQ',
  data: {
    address: {
      address_line_1: 'Salisbury House',
      country: 'United Kingdom',
      locality: '29 Finsbury Circus',
      postal_code: 'EC2M 7AQ',
      premises: '809',
      region: 'London'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 10, year: 1979 },
    etag: 'c4f4e82ddf9222ec6175441ff13617cfd4c2c9eb',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/07551943/persons-with-significant-control/individual/TZBc5LJoJQrz59Ick90D5WRMCkQ'
    },
    name: 'Mr Rasul Chatoo',
    name_elements: { forename: 'Rasul', surname: 'Chatoo', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350873,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/10437451/persons-with-significant-control/individual/P4sSDHatpphGWnIq7LghJZyuL38',
  resource_id: 'P4sSDHatpphGWnIq7LghJZyuL38',
  data: {
    address: {
      address_line_1: 'Old Marylebone Road',
      country: 'England',
      locality: 'London',
      postal_code: 'NW1 5QT',
      premises: '239'
    },
    ceased_on: '2021-01-14',
    country_of_residence: 'England',
    date_of_birth: { month: 10, year: 1979 },
    etag: 'fc86530037a0e3714681c2d2726a4ffa551c40be',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/10437451/persons-with-significant-control/individual/P4sSDHatpphGWnIq7LghJZyuL38'
    },
    name: 'Mr Rasul Chatoo',
    name_elements: { forename: 'Rasul', surname: 'Chatoo', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2016-10-20'
  },
  event: {
    timepoint: 1350874,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/09732799/persons-with-significant-control/individual/V6bUiYSxGby5mvZsQbJCzvBcyrA',
  resource_id: 'V6bUiYSxGby5mvZsQbJCzvBcyrA',
  data: {
    address: {
      address_line_1: 'Old Marylebone Road',
      country: 'England',
      locality: 'London',
      postal_code: 'NW1 5QT',
      premises: '239'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 10, year: 1979 },
    etag: 'f20ae9d28624bd22eab144b69e898c67c89e67bb',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/09732799/persons-with-significant-control/individual/V6bUiYSxGby5mvZsQbJCzvBcyrA'
    },
    name: 'Mr Rasul Chatoo',
    name_elements: { forename: 'Rasul', surname: 'Chatoo', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350875,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11587311/persons-with-significant-control/individual/jQ1xbjWHAihVmnUeYH79JctA8Js',
  resource_id: 'jQ1xbjWHAihVmnUeYH79JctA8Js',
  data: {
    address: {
      address_line_1: 'Admirals Way',
      address_line_2: 'Marsh Wall',
      locality: 'London',
      postal_code: 'E14 9XQ',
      premises: '9 Ensign House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 1, year: 1976 },
    etag: '59db4f07a0eca5726b14ace8c01ff24edbbe6b2f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11587311/persons-with-significant-control/individual/jQ1xbjWHAihVmnUeYH79JctA8Js'
    },
    name: 'Stephen Douglas Lynch',
    name_elements: { forename: 'Stephen', surname: 'Lynch' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2018-09-25'
  },
  event: {
    timepoint: 1350876,
    published_at: '2021-08-20T14:31:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577436/persons-with-significant-control/individual/rXOWZ846jAo8L8UYbOC_H6bR7xs',
  resource_id: 'rXOWZ846jAo8L8UYbOC_H6bR7xs',
  data: {
    address: {
      address_line_1: 'Chamberlain Way',
      country: 'United Kingdom',
      locality: 'Raunds',
      postal_code: 'NN9 6UE',
      premises: '27'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 6, year: 1965 },
    etag: '0a356da422bc0ebe45f073175641b6b89b32e74e',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577436/persons-with-significant-control/individual/rXOWZ846jAo8L8UYbOC_H6bR7xs'
    },
    name: 'Mr Andrew Zasada',
    name_elements: { forename: 'Andrew', surname: 'Zasada', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-50-to-75-percent' ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350877,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/02669295/persons-with-significant-control/individual/U4wYxWvoXS2iKa6XPZ0bAWi5wvQ',
  resource_id: 'U4wYxWvoXS2iKa6XPZ0bAWi5wvQ',
  data: {
    address: {
      address_line_1: 'Vale View Drive',
      address_line_2: 'Beech Hill',
      country: 'United Kingdom',
      locality: 'Reading',
      postal_code: 'RG7 2BD',
      premises: 'Oakdene',
      region: 'Berkshire'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1957 },
    etag: '851f52c36045e5ff67c372456480cae951078c94',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/02669295/persons-with-significant-control/individual/U4wYxWvoXS2iKa6XPZ0bAWi5wvQ'
    },
    name: 'Mr Simon David Charles Kay',
    name_elements: { forename: 'Simon', surname: 'Kay', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'right-to-appoint-and-remove-directors' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350878,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13569926/persons-with-significant-control/individual/trYOHBx_btB1YYPU64VspAI1ZPQ',
  resource_id: 'trYOHBx_btB1YYPU64VspAI1ZPQ',
  data: {
    address: {
      address_line_1: 'Shelton Street',
      address_line_2: 'Covent Garden',
      country: 'United Kingdom',
      locality: 'London',
      postal_code: 'WC2H 9JQ',
      premises: '71-75'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 11, year: 1988 },
    etag: 'cd84220f6ab33a263e8fd3253fb25b93e98b8ae6',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13569926/persons-with-significant-control/individual/trYOHBx_btB1YYPU64VspAI1ZPQ'
    },
    name: 'Mr Joshua Rudi Bonotti',
    name_elements: { forename: 'Joshua', surname: 'Rudi Bonotti', title: 'Mr' },
    nationality: 'Italian',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2021-08-17'
  },
  event: {
    timepoint: 1350879,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577437/persons-with-significant-control/individual/OoMlXCET7G4btE2HQK-l51cuiKg',
  resource_id: 'OoMlXCET7G4btE2HQK-l51cuiKg',
  data: {
    address: {
      address_line_1: 'Sycamore Road',
      address_line_2: 'Aston',
      country: 'United Kingdom',
      locality: 'Birmingham',
      postal_code: 'B6 5UH',
      premises: '25'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 2, year: 1999 },
    etag: '7bab3740788a3e4242fd891c6a3c4294922afd05',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577437/persons-with-significant-control/individual/OoMlXCET7G4btE2HQK-l51cuiKg'
    },
    name: 'Mr Raheel Mohammed',
    name_elements: { forename: 'Raheel', surname: 'Mohammed', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350880,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/04858988/persons-with-significant-control/individual/e9xirumh_8L1ENkDpfl73sNrxbs',
  resource_id: 'e9xirumh_8L1ENkDpfl73sNrxbs',
  data: {
    address: {
      address_line_1: 'Baker Street',
      locality: 'London',
      postal_code: 'W1U 6UE',
      premises: 'Third Floor 126-134',
      region: 'England'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 10, year: 1936 },
    etag: 'd12503ac5e44b6c83343553cdce771bf54012c68',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/04858988/persons-with-significant-control/individual/e9xirumh_8L1ENkDpfl73sNrxbs'
    },
    name: 'Mr Peter Alexander Kohn',
    name_elements: { forename: 'Peter', surname: 'Kohn', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-50-to-75-percent',
      'voting-rights-50-to-75-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350881,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577436/persons-with-significant-control/individual/kCIPo5eDwbSHE-ik15f8RZIUdPU',
  resource_id: 'kCIPo5eDwbSHE-ik15f8RZIUdPU',
  data: {
    address: {
      address_line_1: 'Doddington Road',
      country: 'England',
      locality: 'Wellingborough',
      postal_code: 'NN8 2LE',
      premises: 'Flat 3, Doddington Court, Flat 3'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 2, year: 1989 },
    etag: '9eabe1a09f14bf7ac3eda44569c81a216332ce74',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577436/persons-with-significant-control/individual/kCIPo5eDwbSHE-ik15f8RZIUdPU'
    },
    name: 'Mr Alexandru Adrian Burlacu',
    name_elements: { forename: 'Alexandru', surname: 'Burlacu', title: 'Mr' },
    nationality: 'Romanian',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350882,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/08865878/persons-with-significant-control/individual/VDD7BSeIojqSQrFmlMIkJTHeeE8',
  resource_id: 'VDD7BSeIojqSQrFmlMIkJTHeeE8',
  data: {
    address: {
      address_line_1: '58-60 Kensington Church Street',
      country: 'England',
      locality: 'London',
      postal_code: 'W8 4DB',
      premises: 'Unit 7, Antique Centre'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 1976 },
    etag: 'ed75fdeddd41a24210872d0c7849437cfe5fc681',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/08865878/persons-with-significant-control/individual/VDD7BSeIojqSQrFmlMIkJTHeeE8'
    },
    name: 'Ms Zhuo Han Zhang',
    name_elements: { forename: 'Zhuo', surname: 'Zhang', title: 'Ms' },
    nationality: 'British',
    natures_of_control: [ 'significant-influence-or-control' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350883,
    published_at: '2021-08-20T14:32:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/08146700/persons-with-significant-control/individual/gRqjZ7vJqtFg8NvmFudfmi8WK8M',
  resource_id: 'gRqjZ7vJqtFg8NvmFudfmi8WK8M',
  data: {
    address: {
      address_line_1: 'Croftmeadow Court',
      country: 'England',
      locality: 'Northampton',
      postal_code: 'NN3 8QA',
      premises: '10'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 3, year: 1962 },
    etag: 'e62d3e03d8abc06075152603c36b1364c8941894',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/08146700/persons-with-significant-control/individual/gRqjZ7vJqtFg8NvmFudfmi8WK8M'
    },
    name: 'Mr Stuart Peter Russell',
    name_elements: { forename: 'Stuart', surname: 'Russell', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'significant-influence-or-control' ],
    notified_on: '2016-07-01'
  },
  event: {
    timepoint: 1350884,
    published_at: '2021-08-20T14:32:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13179194/persons-with-significant-control/individual/q6DTaa6aHla_xXaoPEXyAYKoADg',
  resource_id: 'q6DTaa6aHla_xXaoPEXyAYKoADg',
  data: {
    address: {
      address_line_1: 'High Road',
      address_line_2: 'Whetstone',
      country: 'United Kingdom',
      locality: 'London',
      postal_code: 'N20 9HR',
      premises: '1339'
    },
    ceased_on: '2021-08-20',
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 9, year: 1974 },
    etag: '0e73d2001da3508f6aaa27e0df04624c337b1554',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13179194/persons-with-significant-control/individual/q6DTaa6aHla_xXaoPEXyAYKoADg'
    },
    name: 'Dean Martin',
    name_elements: { forename: 'Dean', surname: 'Martin' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2021-02-04'
  },
  event: {
    timepoint: 1350885,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577437/persons-with-significant-control/individual/1R2qK6jUMPoRPK21kontsBUta6I',
  resource_id: '1R2qK6jUMPoRPK21kontsBUta6I',
  data: {
    address: {
      address_line_1: '17 King Edwards Road',
      address_line_2: 'Ruislip',
      country: 'United Kingdom',
      locality: 'London',
      postal_code: 'HA4 7AE',
      premises: '2nd Floor, College House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 2, year: 2001 },
    etag: 'ffb586f683332b121a04e2ec9fe90dff19e1d564',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577437/persons-with-significant-control/individual/1R2qK6jUMPoRPK21kontsBUta6I'
    },
    name: 'Mr Abdul Hussain',
    name_elements: { forename: 'Abdul', surname: 'Hussain', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-50-to-75-percent',
      'voting-rights-50-to-75-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350886,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11118542/persons-with-significant-control/individual/ymnqSK5mH10tV3rT2tCmLADYU_Y',
  resource_id: 'ymnqSK5mH10tV3rT2tCmLADYU_Y',
  data: {
    address: {
      address_line_1: 'Devonshire Street',
      country: 'England',
      locality: 'London',
      postal_code: 'W1W 5DT',
      premises: '4'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 7, year: 1996 },
    etag: '6870e0cfdf2aa637657e13a936618f6a53af274d',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11118542/persons-with-significant-control/individual/ymnqSK5mH10tV3rT2tCmLADYU_Y'
    },
    name: 'Mr Jack Leslie Killick',
    name_elements: { forename: 'Jack', surname: 'Killick', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2017-12-19'
  },
  event: {
    timepoint: 1350887,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11237248/persons-with-significant-control/individual/msig63WW6paU3DpPyt5dftdOUyQ',
  resource_id: 'msig63WW6paU3DpPyt5dftdOUyQ',
  data: {
    address: {
      address_line_1: '4 Devonshire Street',
      country: 'England',
      locality: 'London',
      postal_code: 'W1W 5DT',
      premises: 'Suite 1.4'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 7, year: 1996 },
    etag: '8fe56ac5c34ab1c062d3914723521fa34591c74f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11237248/persons-with-significant-control/individual/msig63WW6paU3DpPyt5dftdOUyQ'
    },
    name: 'Mr Jack Leslie Killick',
    name_elements: { forename: 'Jack', surname: 'Killick', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2018-03-06'
  },
  event: {
    timepoint: 1350888,
    published_at: '2021-08-20T14:32:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11142946/persons-with-significant-control/individual/zyUbDV8MilfVlbiT9Y5vrdSAgk8',
  resource_id: 'zyUbDV8MilfVlbiT9Y5vrdSAgk8',
  data: {
    address: {
      address_line_1: 'Mill Hill Street',
      country: 'England',
      locality: 'Bolton',
      postal_code: 'BL2 2AB',
      premises: 'Lea Scaffolding And Access Limited'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 1987 },
    etag: 'af6367703663aa19492ac9014199c9a93c6da837',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11142946/persons-with-significant-control/individual/zyUbDV8MilfVlbiT9Y5vrdSAgk8'
    },
    name: 'Mr Thomas Lea',
    name_elements: { forename: 'Thomas', surname: 'Lea', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2018-01-10'
  },
  event: {
    timepoint: 1350889,
    published_at: '2021-08-20T14:32:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11142946/persons-with-significant-control/individual/ZK22g5V97t6TJnXPpFQb78RZqrY',
  resource_id: 'ZK22g5V97t6TJnXPpFQb78RZqrY',
  data: {
    address: {
      address_line_1: 'Mill Hill Street',
      country: 'England',
      locality: 'Bolton',
      postal_code: 'BL2 2AB',
      premises: 'Lea Scaffolding And Access Limited'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 8, year: 1992 },
    etag: 'c76cff4afa3e7507d17d03be08ed546e30085fe4',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11142946/persons-with-significant-control/individual/ZK22g5V97t6TJnXPpFQb78RZqrY'
    },
    name: 'Mr James Lea',
    name_elements: { forename: 'James', surname: 'Lea', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2018-01-10'
  },
  event: {
    timepoint: 1350890,
    published_at: '2021-08-20T14:32:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13122947/persons-with-significant-control/individual/gRTe1lTpEUQ7rOtZLUNy5RKwDk8',
  resource_id: 'gRTe1lTpEUQ7rOtZLUNy5RKwDk8',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'Turkey',
    date_of_birth: { month: 3, year: 1974 },
    etag: '699ae25a2bb60a2074e0a13b767b908116f45235',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13122947/persons-with-significant-control/individual/gRTe1lTpEUQ7rOtZLUNy5RKwDk8'
    },
    name: 'Mr Hasan Keskinbicak',
    name_elements: { forename: 'Hasan', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'Turkish',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2021-08-01'
  },
  event: {
    timepoint: 1350891,
    published_at: '2021-08-20T14:32:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/12580425/persons-with-significant-control/individual/DrcM-KM5qTwDnqa3hm1unrihZXQ',
  resource_id: 'DrcM-KM5qTwDnqa3hm1unrihZXQ',
  data: {
    address: {
      address_line_1: 'Sycamore Road',
      address_line_2: 'Aston',
      country: 'England',
      locality: 'Birmingham',
      postal_code: 'B6 5UH',
      premises: '25'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 2, year: 1999 },
    etag: '33a03acc5cd89b256d2e95d2b570ad5c42c2cf5f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/12580425/persons-with-significant-control/individual/DrcM-KM5qTwDnqa3hm1unrihZXQ'
    },
    name: 'Mr Raheel Mohammed',
    name_elements: { forename: 'Raheel', surname: 'Mohammed', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2020-04-30'
  },
  event: {
    timepoint: 1350892,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13039919/persons-with-significant-control/individual/H7rnNX9GcacGgmaHMXjJ3FU8TLk',
  resource_id: 'H7rnNX9GcacGgmaHMXjJ3FU8TLk',
  data: {
    address: {
      address_line_1: 'Folds Road',
      country: 'England',
      locality: 'Bolton',
      postal_code: 'BL1 2RZ',
      premises: 'Regent House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 9, year: 1988 },
    etag: '3dd5679c37f0793552f3ed95fc6132022936646e',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13039919/persons-with-significant-control/individual/H7rnNX9GcacGgmaHMXjJ3FU8TLk'
    },
    name: 'Mrs Dhara Jethwa',
    name_elements: { forename: 'Dhara', surname: 'Jethwa', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2020-11-24'
  },
  event: {
    timepoint: 1350893,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13039904/persons-with-significant-control/individual/nYqAClVRvFbXncceYbtZ53h1Vl4',
  resource_id: 'nYqAClVRvFbXncceYbtZ53h1Vl4',
  data: {
    address: {
      address_line_1: 'Folds Road',
      country: 'England',
      locality: 'Bolton',
      postal_code: 'BL1 2RZ',
      premises: 'Regent House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 9, year: 1988 },
    etag: 'd87501ca048619e761bbe52eaf1d882d8d026f2f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13039904/persons-with-significant-control/individual/nYqAClVRvFbXncceYbtZ53h1Vl4'
    },
    name: 'Mrs Dhara Jethwa',
    name_elements: { forename: 'Dhara', surname: 'Jethwa', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2020-11-24'
  },
  event: {
    timepoint: 1350894,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/08564519/persons-with-significant-control/individual/_FwVYaVkgpMK7k7pNp7GS6O9g3k',
  resource_id: '_FwVYaVkgpMK7k7pNp7GS6O9g3k',
  data: {
    address: {
      address_line_1: 'Coventry Business Park',
      address_line_2: 'Herald Avenue',
      country: 'United Kingdom',
      locality: 'Coventry',
      postal_code: 'CV5 6UB',
      premises: '1110 Elliott Court',
      region: 'West Midlands'
    },
    ceased_on: '2019-03-25',
    country_of_residence: 'England',
    date_of_birth: { month: 10, year: 1972 },
    etag: '9803da0b7e614658153b685c21f4010ede90412d',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/08564519/persons-with-significant-control/individual/_FwVYaVkgpMK7k7pNp7GS6O9g3k'
    },
    name: 'Mr Shahzada Khuram Ahmed',
    name_elements: { forename: 'Shahzada', surname: 'Ahmed', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2017-05-01'
  },
  event: {
    timepoint: 1350895,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/06770788/persons-with-significant-control/individual/4L6xvz0xnahXXj-U21yZviDiRrk',
  resource_id: '4L6xvz0xnahXXj-U21yZviDiRrk',
  data: {
    address: {
      address_line_1: 'Mount Pleasant',
      country: 'England',
      locality: 'Barnet',
      postal_code: 'EN4 9EB',
      premises: 'Suite 2a1, Northside House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 3, year: 1955 },
    etag: 'dd264de334fb6b00a3fa4df42660f82009fc069c',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/06770788/persons-with-significant-control/individual/4L6xvz0xnahXXj-U21yZviDiRrk'
    },
    name: 'Mr Simon John Russell Cole',
    name_elements: { forename: 'Simon', surname: 'Cole', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2016-06-04'
  },
  event: {
    timepoint: 1350896,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/09635075/persons-with-significant-control/individual/sLnIWH5kHxNQ31-mb1_KYlYW2jU',
  resource_id: 'sLnIWH5kHxNQ31-mb1_KYlYW2jU',
  data: {
    address: {
      address_line_1: 'Coton Road',
      country: 'England',
      locality: 'Nuneaton',
      postal_code: 'CV11 5TW',
      premises: '24a'
    },
    ceased_on: '2021-08-20',
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1981 },
    etag: 'd65750c7c87826f3652bf0bcf8c49e5372476587',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/09635075/persons-with-significant-control/individual/sLnIWH5kHxNQ31-mb1_KYlYW2jU'
    },
    name: 'Mrs Sophie Blacklaws',
    name_elements: { forename: 'Sophie', surname: 'Blacklaws', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2018-03-30'
  },
  event: {
    timepoint: 1350897,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13122947/persons-with-significant-control/individual/Qu8dpB09ONrQWcK5ocQGTjU3tfc',
  resource_id: 'Qu8dpB09ONrQWcK5ocQGTjU3tfc',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'Turkey',
    date_of_birth: { month: 6, year: 1971 },
    etag: 'df67da2914a671c8a79a1a4d807062adcaeabad5',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13122947/persons-with-significant-control/individual/Qu8dpB09ONrQWcK5ocQGTjU3tfc'
    },
    name: 'Mr Tahir Can',
    name_elements: { forename: 'Tahir', surname: 'Can', title: 'Mr' },
    nationality: 'Turkish',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2021-08-01'
  },
  event: {
    timepoint: 1350898,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13039904/persons-with-significant-control/individual/nYqAClVRvFbXncceYbtZ53h1Vl4',
  resource_id: 'nYqAClVRvFbXncceYbtZ53h1Vl4',
  data: {
    address: {
      address_line_1: 'Folds Road',
      country: 'England',
      locality: 'Bolton',
      postal_code: 'BL1 2RZ',
      premises: 'Regent House'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 9, year: 1988 },
    etag: 'd87501ca048619e761bbe52eaf1d882d8d026f2f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13039904/persons-with-significant-control/individual/nYqAClVRvFbXncceYbtZ53h1Vl4'
    },
    name: 'Mrs Dhara Jethwa',
    name_elements: { forename: 'Dhara', surname: 'Jethwa', title: 'Mrs' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2020-11-24'
  },
  event: {
    timepoint: 1350899,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577438/persons-with-significant-control/individual/wWvJqFs_YyNS59hTJ3hBh1N5U28',
  resource_id: 'wWvJqFs_YyNS59hTJ3hBh1N5U28',
  data: {
    address: {
      address_line_1: 'Stoneylands Road',
      country: 'England',
      locality: 'Egham',
      postal_code: 'TW20 9QR',
      premises: 'Flat 8 The Hub',
      region: 'Surrey'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1991 },
    etag: 'ced6c83fc8b6e9f1fcb3fd0a9af4a684a670ee64',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577438/persons-with-significant-control/individual/wWvJqFs_YyNS59hTJ3hBh1N5U28'
    },
    name: 'Ms Liangzi Xiao',
    name_elements: { forename: 'Liangzi', surname: 'Xiao', title: 'Ms' },
    nationality: 'Chinese',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350900,
    published_at: '2021-08-20T14:33:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/03620144/persons-with-significant-control/individual/nUA223LInb40ORESpRtds0Tof5Y',
  resource_id: 'nUA223LInb40ORESpRtds0Tof5Y',
  data: {
    address: {
      address_line_1: 'Brook Lane',
      address_line_2: 'Westbury',
      locality: 'Wiltshire',
      postal_code: 'BA13 4ES',
      premises: 'Westbury Park Engineering Ltd'
    },
    ceased_on: '2021-08-17',
    country_of_residence: 'England',
    date_of_birth: { month: 9, year: 1971 },
    etag: 'd164b3c6758c98f6696c8be0562cd674c30f8f09',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/03620144/persons-with-significant-control/individual/nUA223LInb40ORESpRtds0Tof5Y'
    },
    name: 'Mr James Paul Brain',
    name_elements: { forename: 'James', surname: 'Brain', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-50-to-75-percent' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350901,
    published_at: '2021-08-20T14:33:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577439/persons-with-significant-control/individual/jporMPI6ElG5xvwmccwCOf_JTiU',
  resource_id: 'jporMPI6ElG5xvwmccwCOf_JTiU',
  data: {
    address: {
      address_line_1: 'Wheeler Orchard',
      country: 'England',
      locality: 'Tenbury Wells',
      postal_code: 'WR15 8DQ',
      premises: '58'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1996 },
    etag: 'b977d4e7578ab08636e38ccc96769b430eb4a672',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577439/persons-with-significant-control/individual/jporMPI6ElG5xvwmccwCOf_JTiU'
    },
    name: 'Mr Oberon Jai Howells',
    name_elements: { forename: 'Oberon', surname: 'Howells', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350902,
    published_at: '2021-08-20T14:33:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577440/persons-with-significant-control/individual/4x88aqAjoiUQN3sIGD8n4Xy7Irc',
  resource_id: '4x88aqAjoiUQN3sIGD8n4Xy7Irc',
  data: {
    address: {
      address_line_1: '2 Cornmarket Court',
      country: 'England',
      locality: 'Wimborne',
      postal_code: 'BH21 1JL',
      premises: 'Beaufort House',
      region: 'Dorset'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 6, year: 1967 },
    etag: '84b28849d7cb22c37026346d6d2558277b6f699f',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577440/persons-with-significant-control/individual/4x88aqAjoiUQN3sIGD8n4Xy7Irc'
    },
    name: 'Miss Alison Suzanne Martin',
    name_elements: { forename: 'Alison', surname: 'Martin', title: 'Miss' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-50-to-75-percent',
      'voting-rights-50-to-75-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350903,
    published_at: '2021-08-20T14:34:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13576724/persons-with-significant-control/individual/vrDGsESEQlLZ5f6M_4glZAkTjiM',
  resource_id: 'vrDGsESEQlLZ5f6M_4glZAkTjiM',
  data: {
    address: {
      address_line_1: '2 Cornmarket Court',
      country: 'England',
      locality: 'Wimborne',
      postal_code: 'BH21 1JL',
      premises: 'Beaufort House',
      region: 'Dorset'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 6, year: 1967 },
    etag: '3916861f4636787392d6499d33e43d3741ae906b',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13576724/persons-with-significant-control/individual/vrDGsESEQlLZ5f6M_4glZAkTjiM'
    },
    name: 'Miss Alison Suzanne Martin',
    name_elements: { forename: 'Alison', surname: 'Martin', title: 'Miss' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-50-to-75-percent',
      'voting-rights-50-to-75-percent'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350904,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-corporate',
  resource_uri: '/company/08564519/persons-with-significant-control/corporate-entity/FE_FnOPWgPEZ1zuBzIEhqmTM7Ds',
  resource_id: 'FE_FnOPWgPEZ1zuBzIEhqmTM7Ds',
  data: {
    address: {
      address_line_1: 'Edgbaston',
      country: 'United Kingdom',
      locality: 'Birmingham',
      postal_code: 'B15 2LD',
      premises: '2 Wheeleys Road',
      region: 'West Midlands'
    },
    etag: 'd7d3b6b567befe248ee8c81d0df74d29ca3d98fe',
    identification: {
      country_registered: 'England And Wales',
      legal_authority: 'England & Wales',
      legal_form: 'Limited Company',
      place_registered: 'Companies House',
      registration_number: '11583495'
    },
    kind: 'corporate-entity-person-with-significant-control',
    links: {
      self: '/company/08564519/persons-with-significant-control/corporate-entity/FE_FnOPWgPEZ1zuBzIEhqmTM7Ds'
    },
    name: 'Armighorn Capital Limited',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2019-03-25'
  },
  event: {
    timepoint: 1350905,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577441/persons-with-significant-control/individual/mHkONXBXX6_ImS0HdA1DsPwVDek',
  resource_id: 'mHkONXBXX6_ImS0HdA1DsPwVDek',
  data: {
    address: {
      address_line_1: 'Franklin Street',
      country: 'United States',
      locality: 'Buffalo',
      postal_code: '14202',
      premises: '369',
      region: 'New York'
    },
    country_of_residence: 'United States',
    date_of_birth: { month: 8, year: 1962 },
    etag: 'fd248774784359703f398a0ff51eef5a56e9c9e4',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577441/persons-with-significant-control/individual/mHkONXBXX6_ImS0HdA1DsPwVDek'
    },
    name: 'Mr Jeffrey Mark Weinzweig',
    name_elements: { forename: 'Jeffrey', surname: 'Weinzweig', title: 'Mr' },
    nationality: 'Canadian',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350906,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/07108610/persons-with-significant-control/individual/qhoZr_j9U0AJz62xTfbmFCTBd54',
  resource_id: 'qhoZr_j9U0AJz62xTfbmFCTBd54',
  data: {
    address: {
      address_line_1: 'Mount Pleasant',
      country: 'England',
      locality: 'Barnet',
      postal_code: 'EN4 9EB',
      premises: 'Suite 2a1, Northside House'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 3, year: 1959 },
    etag: '9c58a3350788b4ba23fe0bc3b35476afef200e5e',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/07108610/persons-with-significant-control/individual/qhoZr_j9U0AJz62xTfbmFCTBd54'
    },
    name: 'Mr Richard Miles Andrew Horlick',
    name_elements: { forename: 'Richard', surname: 'Horlick', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350907,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11533671/persons-with-significant-control/individual/Lg6Se5Ch8C6DA7sQIXRzfHUhsWA',
  resource_id: 'Lg6Se5Ch8C6DA7sQIXRzfHUhsWA',
  data: {
    address: {
      address_line_1: 'High Road',
      country: 'England',
      locality: 'London',
      postal_code: 'N17 8EY',
      premises: '869'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 2, year: 1969 },
    etag: 'b5cbf8c1e2e1b48b65c58e71573b4b38a208a7ac',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11533671/persons-with-significant-control/individual/Lg6Se5Ch8C6DA7sQIXRzfHUhsWA'
    },
    name: 'Mr Ali Keskinbicak',
    name_elements: { forename: 'Ali', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'significant-influence-or-control' ],
    notified_on: '2020-02-03'
  },
  event: {
    timepoint: 1350908,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577442/persons-with-significant-control/individual/rj1N9WGcGvE9KyWC07U4qQ6WkRY',
  resource_id: 'rj1N9WGcGvE9KyWC07U4qQ6WkRY',
  data: {
    address: {
      address_line_1: 'Bordesley Green East',
      country: 'United Kingdom',
      locality: 'Birmingham',
      postal_code: 'B33 8QB',
      premises: '342'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 2005 },
    etag: 'c93f6e9c824c4c8a74cf646699a6919b52527ff1',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577442/persons-with-significant-control/individual/rj1N9WGcGvE9KyWC07U4qQ6WkRY'
    },
    name: 'Mr Hamzah Afsar',
    name_elements: { forename: 'Hamzah', surname: 'Afsar', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350909,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/12186390/persons-with-significant-control/individual/fx_2LD1HK42xQfpChcZT_l938HA',
  resource_id: 'fx_2LD1HK42xQfpChcZT_l938HA',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 2, year: 1969 },
    etag: 'aed5c7cda8e68c2bb5e9a0b56207d3a8b869aa10',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/12186390/persons-with-significant-control/individual/fx_2LD1HK42xQfpChcZT_l938HA'
    },
    name: 'Mr Ali Keskinbicak',
    name_elements: { forename: 'Ali', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-75-to-100-percent' ],
    notified_on: '2019-10-01'
  },
  event: {
    timepoint: 1350910,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13197207/persons-with-significant-control/individual/NcUko-TsUyqEqyY0IAmzzIh1KH0',
  resource_id: 'NcUko-TsUyqEqyY0IAmzzIh1KH0',
  data: {
    address: {
      address_line_1: 'Church Street',
      address_line_2: 'Burnham',
      country: 'England',
      locality: 'Slough',
      postal_code: 'SL1 7HZ',
      premises: '2'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 1, year: 1971 },
    etag: 'e069387d3898f5e7f9263ebbbfbc420f52d5aa79',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13197207/persons-with-significant-control/individual/NcUko-TsUyqEqyY0IAmzzIh1KH0'
    },
    name: 'Ms Kirsty Ellen Wilson',
    name_elements: { forename: 'Kirsty', surname: 'Wilson', title: 'Ms' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-02-11'
  },
  event: {
    timepoint: 1350911,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577442/persons-with-significant-control/individual/FWre8ozDaebzdsM9RccQi7ZdPak',
  resource_id: 'FWre8ozDaebzdsM9RccQi7ZdPak',
  data: {
    address: {
      address_line_1: 'Bordesley Green East',
      country: 'United Kingdom',
      locality: 'Birmingham',
      postal_code: 'B33 8QB',
      premises: '342'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 4, year: 1992 },
    etag: '0475977853be3e0380ed2a9a4e2e5906c52236ed',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577442/persons-with-significant-control/individual/FWre8ozDaebzdsM9RccQi7ZdPak'
    },
    name: 'Mr Hassan Afsar',
    name_elements: { forename: 'Hassan', surname: 'Afsar', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350912,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11549384/persons-with-significant-control/individual/MgVdYGB5JirJEQ9CACq8qnTlFLo',
  resource_id: 'MgVdYGB5JirJEQ9CACq8qnTlFLo',
  data: {
    address: {
      address_line_1: 'The Street',
      address_line_2: 'South Walsham',
      country: 'England',
      locality: 'Norwich',
      postal_code: 'NR13 6AH',
      premises: 'The Garage'
    },
    country_of_residence: 'United Kingdom',
    date_of_birth: { month: 4, year: 1975 },
    etag: 'f3a0eab2cd90f76968c92914aad72a0c6dfc3062',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11549384/persons-with-significant-control/individual/MgVdYGB5JirJEQ9CACq8qnTlFLo'
    },
    name: 'Mr Richard Knight',
    name_elements: { forename: 'Richard', surname: 'Knight', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2018-09-03'
  },
  event: {
    timepoint: 1350913,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13577442/persons-with-significant-control/individual/WNepbyzqBIZ4eaczh_kxng024h8',
  resource_id: 'WNepbyzqBIZ4eaczh_kxng024h8',
  data: {
    address: {
      address_line_1: 'Bordesley Green East',
      country: 'United Kingdom',
      locality: 'Birmingham',
      postal_code: 'B33 8QB',
      premises: '342'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 4, year: 1992 },
    etag: '9c06427910b520207a6119962890f1b2e0493260',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13577442/persons-with-significant-control/individual/WNepbyzqBIZ4eaczh_kxng024h8'
    },
    name: 'Mr Hussain Nadeem Afsar',
    name_elements: { forename: 'Hussain', surname: 'Afsar', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-08-20'
  },
  event: {
    timepoint: 1350914,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13122947/persons-with-significant-control/individual/z7d6yPDMV-nFc-lyTWCszh51VC0',
  resource_id: 'z7d6yPDMV-nFc-lyTWCszh51VC0',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'Turkey',
    date_of_birth: { month: 9, year: 1986 },
    etag: '145a860d263deebe7653b1cc37fe2e6e62518930',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13122947/persons-with-significant-control/individual/z7d6yPDMV-nFc-lyTWCszh51VC0'
    },
    name: 'Mr Omer Arslan',
    name_elements: { forename: 'Omer', surname: 'Arslan', title: 'Mr' },
    nationality: 'Turkish',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2021-08-01'
  },
  event: {
    timepoint: 1350915,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13122947/persons-with-significant-control/individual/u-y6JO9KyA8RVzIO0K1tvpZIsyE',
  resource_id: 'u-y6JO9KyA8RVzIO0K1tvpZIsyE',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 2, year: 1969 },
    etag: 'aef9ff094aeac6f6b8c3b64ec83819fdf9ae558c',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13122947/persons-with-significant-control/individual/u-y6JO9KyA8RVzIO0K1tvpZIsyE'
    },
    name: 'Mr Ali Keskinbicak',
    name_elements: { forename: 'Ali', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-50-to-75-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-01-08'
  },
  event: {
    timepoint: 1350916,
    published_at: '2021-08-20T14:35:01',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/11333801/persons-with-significant-control/individual/jQ2tbUwSJxy7PlWCD_04N4GNdL4',
  resource_id: 'jQ2tbUwSJxy7PlWCD_04N4GNdL4',
  data: {
    address: {
      address_line_1: 'Kingsland Road',
      country: 'United Kingdom',
      locality: 'London',
      postal_code: 'E8 4AU',
      premises: '485'
    },
    ceased_on: '2018-05-21',
    country_of_residence: 'England',
    date_of_birth: { month: 2, year: 1969 },
    etag: '79a804590a42809e97b5966e8ac1ebca56c38c68',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/11333801/persons-with-significant-control/individual/jQ2tbUwSJxy7PlWCD_04N4GNdL4'
    },
    name: 'Mr Ali Keskinbicak',
    name_elements: { forename: 'Ali', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2018-04-27'
  },
  event: {
    timepoint: 1350917,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13122947/persons-with-significant-control/individual/u-y6JO9KyA8RVzIO0K1tvpZIsyE',
  resource_id: 'u-y6JO9KyA8RVzIO0K1tvpZIsyE',
  data: {
    address: {
      address_line_1: 'Tower Bridge Road',
      country: 'England',
      locality: 'London',
      postal_code: 'SE1 2UP',
      premises: '224a'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 2, year: 1969 },
    etag: 'aef9ff094aeac6f6b8c3b64ec83819fdf9ae558c',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13122947/persons-with-significant-control/individual/u-y6JO9KyA8RVzIO0K1tvpZIsyE'
    },
    name: 'Mr Ali Keskinbicak',
    name_elements: { forename: 'Ali', surname: 'Keskinbicak', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-50-to-75-percent',
      'right-to-appoint-and-remove-directors'
    ],
    notified_on: '2021-01-08'
  },
  event: {
    timepoint: 1350918,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/13306855/persons-with-significant-control/individual/YtjDDsnOh39mSBMBl6FpQQ1V0vA',
  resource_id: 'YtjDDsnOh39mSBMBl6FpQQ1V0vA',
  data: {
    address: {
      address_line_1: 'Covert Lane',
      address_line_2: 'Scraptoft',
      country: 'United Kingdom',
      locality: 'Leicester',
      postal_code: 'LE7 9SP',
      premises: 'Wayside Lodge'
    },
    country_of_residence: 'England',
    date_of_birth: { month: 5, year: 1965 },
    etag: 'c2398ed7afbe10b6769ce03768b094378cee6689',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/13306855/persons-with-significant-control/individual/YtjDDsnOh39mSBMBl6FpQQ1V0vA'
    },
    name: 'Dr Andrew Peter Hall',
    name_elements: { forename: 'Andrew', surname: 'Hall', title: 'Dr' },
    nationality: 'British',
    natures_of_control: [
      'ownership-of-shares-25-to-50-percent',
      'voting-rights-25-to-50-percent'
    ],
    notified_on: '2021-03-31'
  },
  event: {
    timepoint: 1350919,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-individual',
  resource_uri: '/company/06926162/persons-with-significant-control/individual/GPCPIFoz2dsw6FF17lUht4HTydI',
  resource_id: 'GPCPIFoz2dsw6FF17lUht4HTydI',
  data: {
    address: {
      address_line_1: '393 North End Road',
      country: 'United Kingdom',
      locality: 'Fulham',
      postal_code: 'SW6 1NR',
      premises: 'Unit 1',
      region: 'London'
    },
    ceased_on: '2021-08-19',
    country_of_residence: 'England',
    date_of_birth: { month: 6, year: 1955 },
    etag: '5dcf43172a116d867cc09cf00d09dc064f134ed6',
    kind: 'individual-person-with-significant-control',
    links: {
      self: '/company/06926162/persons-with-significant-control/individual/GPCPIFoz2dsw6FF17lUht4HTydI'
    },
    name: 'Mr Luther De Gale',
    name_elements: { forename: 'Luther', surname: 'De Gale', title: 'Mr' },
    nationality: 'British',
    natures_of_control: [ 'ownership-of-shares-25-to-50-percent' ],
    notified_on: '2016-04-06'
  },
  event: {
    timepoint: 1350920,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
},
{
  resource_kind: 'company-psc-corporate',
  resource_uri: '/company/12388666/persons-with-significant-control/corporate-entity/fy9S4_HZSPc2BbfoiWMK72FQmeI',
  resource_id: 'fy9S4_HZSPc2BbfoiWMK72FQmeI',
  data: {
    address: {
      address_line_1: 'Welbeck Street',
      country: 'United Kingdom',
      locality: 'London',
      premises: '51'
    },
    etag: 'ccd5f06fed13a5708a1ac9e55d100f81bc27e14f',
    identification: {
      country_registered: 'England And Wales',
      legal_authority: 'England And Wales',
      legal_form: 'Limited Company',
      place_registered: 'Companies House',
      registration_number: '12381750'
    },
    kind: 'corporate-entity-person-with-significant-control',
    links: {
      self: '/company/12388666/persons-with-significant-control/corporate-entity/fy9S4_HZSPc2BbfoiWMK72FQmeI'
    },
    name: 'R Blue Capital Limited',
    natures_of_control: [
      'ownership-of-shares-75-to-100-percent',
      'voting-rights-75-to-100-percent'
    ],
    notified_on: '2020-01-06'
  },
  event: {
    timepoint: 1350921,
    published_at: '2021-08-20T14:35:02',
    type: 'changed'
  }
}
]