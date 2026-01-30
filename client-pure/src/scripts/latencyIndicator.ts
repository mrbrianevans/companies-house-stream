export let delay: number;

export function setDelay(streamPath: string, delayMs: number) {
  delay = delayMs;
  document.getElementById(`delay-${streamPath}`).innerText = `${delay.toFixed(1)} min delay`;
}
