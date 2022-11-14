

export function startStatusManager() {
  updateHealthIndicators()
  setTimeout(updateHealthIndicators, 500) // another status update after 500ms to update users online count
  setInterval(updateHealthIndicators, 5000)
}


function updateHealthIndicators(){
  getHealth().then(health=>{
    for (const streamPath in health){
      const indicator = document.getElementById(`${streamPath}-upstream`)
      if(!indicator) continue
      if(health[streamPath]) {
        indicator.classList.add('good')
        indicator.classList.remove('bad')
      }else{
        indicator.classList.remove('good')
        indicator.classList.add('bad')
      }
    }
    const {currentWsConnections} = health
    document.getElementById('open-websockets').innerText = currentWsConnections.toString()
  }).catch(e=>{
    console.log('Health indicators failed to update:', e.message)
  })
}

async function getHealth(){
  const res = await fetch("/events/health")
  if(res.ok) return await res.json()
  else throw new Error('Could not get health status')
}
