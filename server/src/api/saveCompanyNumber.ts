import { RedisClient } from "../utils/getRedisClient.js"

// number of random company numbers kept in redis
const MAX_RANDOM_SIZE = 50_000

/** returns true if a company number was added, false if it already existed or couldn't be parsed */
export async function saveCompanyNumber(redis: RedisClient, event, streamPath) {
  const companyNumber = getCompanyNumber(event, streamPath)
  if (companyNumber) {
    const existed = await redis.sAdd("companyNumbers", companyNumber).then(res => res === 1)
    //check the size of the set and if its greater than a threshold (eg 5000) then delete a random item
    // if (!existed)
    {
      const size = await redis.sCard("companyNumbers")
      if (size > MAX_RANDOM_SIZE) {
        const remove = await redis.sRandMember("companyNumbers")
        await redis.sRem("companyNumbers", remove)
      }
    }
    return existed
  }
  return false
}


/** Gets the company number from an event, based on which stream the event was sent on */
function getCompanyNumber(event, streamPath: string) {
  switch (streamPath) {
    case "companies":
      return event.data.company_number
    case "filings": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/filing-history/)
      return companyNumber
    }
    case "officers": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/appointments/)
      return companyNumber
    }
    case "persons-with-significant-control": {
      const [, companyNumber] = event.resource_uri.match(
        /^\/company\/([A-Z0-9]{6,8})\/persons-with-significant-control/
      )
      return companyNumber
    }
    case "charges": {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/charges/)
      return companyNumber
    }
    case "insolvency-cases":
      return event.resource_id
    default:
      return ""
  }
}
