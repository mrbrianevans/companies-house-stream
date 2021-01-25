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

const pushEvent = (e) => {
  document.querySelector("#notification-counter").innerHTML = (Number(document.querySelector("#notification-counter").innerHTML) + 1).toString()
  const eventCard = document.createElement('div')
  switch (e.resource_kind || e.source) {
    case 'company-profile': // layout for company profile change card
      const newCompany = (new Date(e.data.date_of_creation).valueOf() > Date.now() - 86400000)
      eventCard.innerHTML = `<div class="companies-card">
    <div class="row">
      <h3>${e.data.company_name}</h3>
      <sub><code><a href="http://data.companieshouse.gov.uk/doc/company/${e.data.company_number}" target="_blank">${e.data.company_number}</a></code></sub>
    </div>
    <p class="new-company">${newCompany ? 'New company' : ''}</p>
    <p>${e.event.type} ${e.resource_kind} at ${new Date(e.event.published_at).toLocaleTimeString()}</p>
    </div>`
        break;
    case 'filing-history':
      const companyNumber = e.companyNumber
      eventCard.innerHTML = `
        <div class="filing-card">
    <div class="row">
      <h3>${e.title}</h3>
      <sub><code><a href="http://data.companieshouse.gov.uk/doc/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${e.description}</p>
    <p>${e.companyProfile?.name || e.companyNumber} at ${new Date(e.published).toLocaleTimeString()}</p>
    </div>
        `
      break;
    case 'company-charges':
      console.log(e)
      eventCard.innerHTML = `
        <div class="alert"><h3>Charges Card!</h3>
        <p>${e.resource_kind}</p></div>
        
        `
      break;
    case 'company-insolvency':
      eventCard.innerHTML = `
        <div class="alert"><h3>INSOLVENCY CASE!</h3>
        <p>${e.resource_kind}</p></div>
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
