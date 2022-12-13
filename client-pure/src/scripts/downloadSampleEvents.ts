

export async function downloadSampleEvents(streamPath: string, qty = 100){
  const query = new URLSearchParams({qty: qty.toFixed(0)})
  const events = await fetch('/events/downloadHistory/'+streamPath+'?'+query.toString()).then(r=>r.json())
  const fileContent = getNdjson(events)
  const blob = new Blob([fileContent],{type: 'application/x-ndjson', endings: 'transparent'})
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'sample-'+streamPath+'-events.json';
  link.click();
  URL.revokeObjectURL(link.href);
}


function getNdjson(array: any[]){
  return array.map(({ received, ...i })=>JSON.stringify(i)).join('\n')
}
