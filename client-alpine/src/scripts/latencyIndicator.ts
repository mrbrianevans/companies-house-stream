
export let latency: number
export function setLatency(latencyMs: number){
  latency = latencyMs
  document.getElementById('latency').innerText = latency.toFixed(1) + 'ms'
}

export let delay: number
export function setDelay(streamPath: string, delayMs: number){
  delay = delayMs
  document.getElementById(`delay-${streamPath}`).innerText = `Delay: ${delay.toFixed(1)} min`
}
