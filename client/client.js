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
  switch(e.resource_kind) {
      case 'company-profile': // layout for company profile change card
        const newCompany = (new Date(e.data.date_of_creation).valueOf()>Date.now()-86400000)
      eventCard.innerHTML = `<div>
    <div class="row">
      <h3>${e.data.company_name}</h3>
      <sub><code>${e.data.company_number}</code></sub>
    </div>
    <p class="new-company">${newCompany?'New company':''}</p>
    <p>${e.event.type} ${e.resource_kind} at ${new Date(e.event.published_at).toLocaleTimeString()}</p>
    </div>`
        break;
      case '': // psc or something else
        break;
      default:
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

    socket.on('disconnect', ()=> {
        setConnected(false)
        clearInterval(clock)
    })
  socket.on('event', pushEvent)
  socket.on('heartbeat', heartbeat)
  const clock = setInterval(()=>{
    document.querySelector('#clock').innerHTML = new Date().toLocaleTimeString()
  }, 1000)
})
