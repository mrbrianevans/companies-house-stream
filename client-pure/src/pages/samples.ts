
import '../styles/theme.scss'
import '../styles/samples.scss'
import '../styles/events.scss'

import { streamPaths } from "../scripts/streamPaths"
import { downloadSampleEvents, getSampleEvents } from "../scripts/downloadSampleEvents"

// run when samples page is loaded
function initSamplesPage(){
  { // downloads
    const container = document.getElementById("download-streams-container")

    const qtyLabel = document.createElement("label")
    qtyLabel.innerText = "Qty: "
    const qtyBox = document.createElement("input")
    qtyBox.value = "100"
    qtyLabel.appendChild(qtyBox)
    container.appendChild(qtyLabel)
    for (const streamPath of streamPaths) {
      const downloadButton = document.createElement("button")
      downloadButton.innerText = "Download " + streamPath + " samples"
      downloadButton.className = streamPath
      downloadButton.addEventListener("click", () => downloadSampleEvents(streamPath, parseInt(qtyBox.value) || 10))
      container.appendChild(downloadButton)
    }
  }

  { // view
    const container = document.getElementById("view-streams-container")
    const viewer = document.getElementById("view-samples")
    const description = document.getElementById("sample-description")
    for (const streamPath of streamPaths) {
      const viewButton = document.createElement("button")
      viewButton.innerText = "View " + streamPath + " sample"
      viewButton.className = streamPath
      viewButton.addEventListener("click", () => getSampleEvents(streamPath, 1).then(r=> {
        const { received, ...event } = r[0]
        viewer.innerText = JSON.stringify(event, null, 2)
        description.innerText = 'Event received on '+streamPath+' stream at '+new Date(received).toISOString()+'.'
      }))
      container.appendChild(viewButton)
    }
  }

  { // schemas
    const container = document.getElementById("schemas-container")
    const viewer = document.getElementById("view-schema")
    const description = document.getElementById("schema-description")
    fetch('/events/schemas').then(r=>r.json()).then(schemas => {
      for (const schema in schemas) {
        const viewButton = document.createElement("button")
        viewButton.innerText = "View " + schema + " schema"
        viewButton.addEventListener("click", () => {
          viewer.innerText = JSON.stringify(schemas[schema], null, 2)
          description.innerText = 'Schema for ' + schema
        })
        container.appendChild(viewButton)
      }
    })
  }
}

initSamplesPage()
