const socket = io()
let connected = false
document.querySelector('#clock').innerHTML = new Date().toLocaleTimeString()
const setConnected = (bool) => {
  connected = bool
  document.querySelector('#connection-status').innerHTML = connected?"Connected":"Disconnected"
  document.querySelector('#connection-status').className = connected?"connected":"disconnected"
  document.querySelector("#connection-status").onclick = ()=>{
    console.log("Button pressed, connection:", connected)
      if(connected)
        socket.close()
      else
        socket.connect()
    }
}

const pushEvent = async (e) => {
  document.querySelector("#notification-counter").innerHTML = (Number(document.querySelector("#notification-counter").innerHTML) + 1).toString()
  const eventCard = document.createElement('div')
  switch (e.resource_kind || e.source) {
    case 'company-profile': // layout for company profile change card
      eventCard.innerHTML = await companyProfileCard(e)
      break;
    case 'filing-history':
      eventCard.innerHTML = await filingHistoryCard(e)
      break;
    case 'company-charges':
      const [, chargeCompanyNumber] = e.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/charges/)
      console.log(e)
      eventCard.innerHTML = `
        <div class="alert"><h3>Company Charge
        <sub><code><a href="https://companies-house-frontend-api-rmfuc.ondigitalocean.app/company/${chargeCompanyNumber}" target="_blank">${chargeCompanyNumber}</a></code></sub>
        </h3>
        <p>${e.data.classification.description}</p>
        <p>Published at ${new Date(e.event.published_at).toLocaleTimeString()}</p>
        </div>
        `
      break;
    case 'company-insolvency':
      eventCard.innerHTML = `
        <div class="alert"><h3>INSOLVENCY
        <sub><code><a href="https://companies-house-frontend-api-rmfuc.ondigitalocean.app/company/${e.resource_id}" target="_blank">${e.resource_id}</a></code></sub>
        </h3><p>${e.data.cases[0].type}</p>
        <p>Published at ${new Date(e.event.published_at).toLocaleTimeString()}</p>
        </div>
        `
      break;
    default:
      eventCard.innerHTML = `
        <div class="alert"><h3>New format of event!</h3>
        <p>${e.resource_kind}</p></div>
        `
      break;
  }
  
  let events = document.querySelector("#events");
  if(events.childElementCount === 15) events.removeChild(events.lastChild)
  events.insertAdjacentElement('afterbegin', eventCard)
}
const heartbeat = () => {
  const eventCard = document.createElement('div')
  eventCard.innerHTML = "<div class='heart-outer'><div class='heart1'></div><div class='heart2'></div><div class='heart3'></div></div>"
  eventCard.className = 'heartbeat'
  let events = document.querySelector("#events");
  if(events.childElementCount === 15) events.removeChild(events.lastChild)
  events.insertAdjacentElement('afterbegin', eventCard)
}
socket.on('connect', ()=>{
    setConnected(true)
  
  socket.on('disconnect', () => {
    setConnected(false)
    clearInterval(clock)
  })
  const clock = setInterval(() => {
    document.querySelector('#clock').innerHTML = new Date().toLocaleTimeString()
  }, 1000)
})

socket.on('event', pushEvent)
socket.on('heartbeat', heartbeat)

const functionUrl = 'https://europe-west1-companies-house-data.cloudfunctions.net/getCompanyInfo?company_number='
const filingHistoryCard = async (event) => {
  const companyNumber = event.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/filing-history/)[1];
  const companyProfile = await fetch(functionUrl + companyNumber).then(r => r.json()).catch(console.error)
  // const description = await fetch('https://europe-west1-companies-house-data.cloudfunctions.net/getFilingEventDescription', {
  //   method: "POST",
  //   headers: {
  //     "content-type": "application/json"
  //   },
  //   body: JSON.stringify({
  //     descriptionTemplate: event.data.description,
  //     values: event.data.description_values
  //   })
  // })
  const e = {
    companyNumber,
    companyProfile,
    description: event.data.description,
    published: new Date(event.event.published_at),
    resource_kind: event.resource_kind,
    source: event.resource_kind,
    title: event.data.category
  };
  return `
      <div class="filing-card">
    <div class="row">
      <h3>${e.companyProfile?.name || e.companyNumber}</h3>
      <sub><code><a href="https://companies-house-frontend-api-rmfuc.ondigitalocean.app/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${e.description}</p>
    <p>${e.title} published at ${e.published.toLocaleTimeString()}</p>
    </div>
        `;
};


const companyProfileCard = async (event) => {
  const companyNumber = event.data.company_number
  // const companyProfile = await fetch(functionUrl+companyNumber).then(r=>r.json())
  const newCompany = (new Date(event.data.date_of_creation).valueOf() > Date.now() - 86400000)
  return `<div class="companies-card"><div class="row">
      <h3>${event.data.company_name}</h3>
      <sub><code><a href="https://companies-house-frontend-api-rmfuc.ondigitalocean.app/company/${event.data.company_number}" target="_blank">${event.data.company_number}</a></code></sub>
    </div>
    <p class="new-company">${newCompany ? 'New company' : ''} ${event.event.fields_changed ? event.event.fields_changed.join(', ') : ''}</p>
    <p>${event.event.type} ${event.resource_kind} at ${new Date(event.event.published_at).toLocaleTimeString()}</p>
    </div>`
}
