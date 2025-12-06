import "../styles/theme.scss"
import "../styles/events.scss"
import "../styles/samples.scss"
import "../styles/layout.css"
import * as echarts from "echarts/core"

import { LineChart } from "echarts/charts"

import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from "echarts/components"

import { SVGRenderer } from "echarts/renderers"
import type {
  ComposeOption,
  DatasetComponentOption,
  GridComponentOption,
  LineSeriesOption,
  TitleComponentOption,
  TooltipComponentOption
} from "echarts"
import { streamColours } from "../scripts/streamPaths"
import { downloadEventCountJson, getCountData } from "../scripts/downloadSampleEvents"
// Register the required components
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  SVGRenderer, LegendComponent
])
type ECOption = ComposeOption<
  | LineSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
>;

const streamPaths = new Set(["filings", "companies", "persons-with-significant-control", "officers", "insolvency-cases"])

{ // downloads
  const container = document.getElementById("download-stats-container")
  for (const streamPath of streamPaths) {
    const downloadButton = document.createElement("button")
    downloadButton.innerText = "Download " + streamPath + " statistics (JSON)"
    downloadButton.className = streamPath
    downloadButton.addEventListener("click", () => downloadEventCountJson(streamPath))
    container.appendChild(downloadButton)
  }
}

{ // event count chart
  const chart = echarts.init(document.getElementById("event-count-chart"))
  const option: ECOption = {
    title: {
      text: "Number of events received per day, by stream",
      subtext: "A count of how many events were received each day. These counts include duplicate events sent by Companies House, so the count of unique events would be lower."
    },
    tooltip: {},
    legend: {
      orient: "horizontal",
      right: 10,
      top: 50
    },
    xAxis: { type: "time" },
    yAxis: {},
    series: [...streamPaths].map(name => ({
      type: "line",
      data: [],
      name,
      color: streamColours[name],
      itemStyle: { opacity: 0 }
    }))
  }
  chart.setOption(option) // draws the chart before any data has loaded

// asynchronously fetch the data for each stream and load it into the chart
  async function loadChartData() {
    for (const streamPath of streamPaths) {
      try {
        console.log("Loading", streamPath, "stats")
        const data = await getCountData(streamPath)
        chart.setOption({
          series: [{
            type: "line",
            data: Object.entries(data).sort(([a], [b]) => a.localeCompare(b)),
            name: streamPath
          }]
        })
      } catch (error) {
        console.error("Failed to load", streamPath, "stats")
      }
    }
  }

  loadChartData()
}

{
  async function getVisitorStats() {
    const { total, today } = await fetch("/events/visitors").then(r => r.json())
    return { total, today }
  }

  async function updateVisitorStatsOnPage() {
    try {
      const { total, today } = await getVisitorStats()
      document.getElementById("visitors-total").innerText = total
      document.getElementById("visitors-today").innerText = today
    } catch (e) {
      console.error("Failed to update usage stats:", e)
    }

  }

  updateVisitorStatsOnPage()
}
