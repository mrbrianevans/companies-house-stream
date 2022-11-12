import copy from "copy-to-clipboard"
import { sentenceCase } from "sentence-case"
import { titleCase } from "title-case"
import { formatFilingDescription } from "./formatFilingDescription"


export function createEventComponent(event){
  const eventCardContainer = document.createElement('div')
  eventCardContainer.className = `event-card-container`
  const element = document.createElement('div')
  element.className = `event-card ${event.streamPath}`
  eventCardContainer.appendChild(element)
  try {
    const { companyNumber, title, description } = getDescription(event)
    element.innerHTML = `
    <h3>${title}</h3>
    <p>${description}</p>
    <span class="published-at">${new Date(event.event.published_at).toLocaleTimeString()}</span>
    <a target="_blank" href="https://find-and-update.company-information.service.gov.uk/company/${companyNumber}"><code>${companyNumber}</code></a>
  `
    // A button which copys the company number on click rather than a link to companies house
    // const companyNumberButton = document.createElement("code")
    // companyNumberButton.onclick = () => copy(companyNumber)
    // companyNumberButton.innerText = companyNumber
    // element.appendChild(companyNumberButton)

    const { received, streamPath, ...originalEvent } = event
    const copyButton = document.createElement("button")
    copyButton.onclick = () => copy(JSON.stringify(originalEvent))
    copyButton.innerText = "JSON"
    element.appendChild(copyButton)
  }catch (e) {
    console.log("Error creating event card: ", e.message)
    element.innerHTML = e.message
  }
  return eventCardContainer
}


function getDescription(event){
  switch (event.streamPath) {
    case 'companies':
      return { companyNumber: event.data.company_number, description: '', title: `${titleCase(event.data.company_name.toLowerCase())}` }
    case 'filings': {
      const [,companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/filing-history/)
      return { companyNumber, description: formatFilingDescription(event.data), title: sentenceCase(event.data.category)+" filing" }
    }
    case 'officers': {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/appointments/)
      const description = 'resigned_on' in event.data ? `Resigned on ${event.data.resigned_on}` : `Appointed on ${event.data.appointed_on}`
      return { companyNumber, description, title: titleCase(event.data.name.toLowerCase()) }
    }
    case 'persons-with-significant-control': {
      const [, companyNumber] = event.resource_uri.match(
        /^\/company\/([A-Z0-9]{6,8})\/persons-with-significant-control/
      )
      const description = 'ceased_on' in event.data ? `Ceased on ${event.data.ceased_on}` : `Notified on ${event.data.notified_on}`
      return { companyNumber, description, title: event.data.name }
    }
    case 'charges': {
      const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{8})\/charges/)
      return { companyNumber, description: event.data.particulars.description, title: event.data.classification.description }
    }
    case 'insolvency-cases':
      return { companyNumber: event.resource_id, description: event.data.cases.map(c=>sentenceCase(c.type)).join(', '), title: 'Insolvency' }
    case 'disqualified-officers':
      return { companyNumber: '', description: 'Disqualified from '+event.data.disqualifications?.flatMap(d=>d.company_names).join(', '), title: [event.data.forename, event.data.other_forenames, event.data.surname].join(' ') }
    default:
      return { companyNumber: '', description: `No description available`, title: titleCase(event.streamPath) }
  }
}

