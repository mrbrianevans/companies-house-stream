import { RedisClient } from "../utils/getRedisClient.js"
import { AnyEvent, CompanyProfileEvent, FilingEvent } from "../types/eventTypes"

// number of random company numbers kept in redis
const MAX_RANDOM_SIZE = 5_000

/** returns true if a company number was added, false if it already existed or couldn't be parsed */
export async function saveCompanyNumber(redis: RedisClient, event: AnyEvent, streamPath: string) {
  const companyNumber = getCompanyNumber(event, streamPath)
  if (companyNumber) {
    const existed = await redis.sAdd("companyNumbers", companyNumber).then(res => res === 1)
    //check the size of the set and if its greater than a threshold (eg 5000) then delete a random item
    // if (!existed)
    {
      const size = await redis.sCard("companyNumbers")
      if (size > MAX_RANDOM_SIZE) {
        const remove = await redis.sRandMember("companyNumbers")
        await redis.sRem("companyNumbers", remove ?? "")
      }
    }
    return existed
  }
  return false
}


/** Gets the company number from an event, based on which stream the event was sent on */
export function getCompanyNumber(event: AnyEvent, streamPath: string) {
  switch (streamPath) {
    case "companies":
      const companyEvent = event as CompanyProfileEvent.CompanyProfileEvent
      return companyEvent.data.company_number
    case "filings": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/filing-history/) ?? []
      return companyNumber
    }
    case "officers": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/appointments/) ?? []
      return companyNumber
    }
    case "persons-with-significant-control": {
      const [, companyNumber] = event.resource_uri.match(
        /^\/company\/([A-Z0-9]{6,8})\/persons-with-significant-control/
      ) ?? []
      return companyNumber
    }
    case "charges": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/charges/) ?? []
      return companyNumber
    }
    case "insolvency-cases":
      return event.resource_id
    case "persons-with-significant-control-statements": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\//) ?? []
      return companyNumber
    }
    case "company-exemptions": {
      const [, companyNumber] = event.resource_uri.match(/company\/([A-Z0-9]{8})\/exemptions/) ?? []
      return companyNumber
    }
    default:
      return ""
  }
}
