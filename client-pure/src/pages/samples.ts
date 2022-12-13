
import '../styles/theme.scss'
import '../styles/samples.scss'
import '../styles/events.scss'

import { streamPaths } from "../scripts/streamPaths"
import { downloadSampleEvents } from "../scripts/downloadSampleEvents"

// run when samples page is loaded
function initSamplesPage(){
  const container = document.getElementById('streams-container')

  const qtyLabel = document.createElement('label')
  qtyLabel.innerText = 'Qty: '
  const qtyBox = document.createElement('input')
  qtyBox.value = '100'
  qtyLabel.appendChild(qtyBox)
  container.appendChild(qtyLabel)
  for (const streamPath of streamPaths) {
    const downloadButton = document.createElement('button')
    downloadButton.innerText = 'Download '+streamPath + ' sample'
    downloadButton.className = streamPath
    downloadButton.addEventListener('click', ()=>downloadSampleEvents(streamPath, parseInt(qtyBox.value)||10))
    container.appendChild(downloadButton)
  }
}

initSamplesPage()
