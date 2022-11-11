

export function startStatusManager() {
  document.addEventListener("visibilitychange", () => {
    document.getElementById("visibility-indicator").className = document.visibilityState + " indicator"
  })
  updateHealthIndicators()
  setInterval(updateHealthIndicators, 5000)
}


function updateHealthIndicators(){
  getHealth().then(health=>{
    console.log('Health check:', health)
  }).catch(e=>{
    console.log('Health indicators failed to update:', e.message)
  })
}

async function getHealth(){
  const res = await fetch("/events/health")
  if(res.ok) return await res.json()
  else throw new Error('Could not get health status')
}
