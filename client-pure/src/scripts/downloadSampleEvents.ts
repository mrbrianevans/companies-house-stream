export async function getSampleEvents(streamPath: string, qty = 100){
  // return [{naem:'event',received:Date.now()}]
  const query = new URLSearchParams({qty: qty.toFixed(0)})
  const events = await fetch('/events/downloadHistory/'+streamPath+'?'+query.toString()).then(r=>r.json())
  return events
}

export async function downloadSampleEvents(streamPath: string, qty = 100){
  const events = await getSampleEvents(streamPath, qty)
  const fileContent = getNdjson(events)
  const blob = new Blob([fileContent],{type: 'application/x-ndjson', endings: 'transparent'})
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = "sample-" + streamPath + "-events.json"
  link.click()
  URL.revokeObjectURL(link.href)
}


function getNdjson(array: any[]) {
  return array.map(({ received, ...i }) => JSON.stringify(i)).join("\n")
}

export async function downloadStringAsFile(fileContent: string, filename: string, fileType: string) {
  const blob = new Blob([fileContent], { type: fileType, endings: "transparent" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
