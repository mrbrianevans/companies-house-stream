import { GraphConfig } from "./graphConfig.js";
const main = () => {
  console.log("Running main")
  if (typeof google === 'undefined') return
  else clearInterval(attemptGoogle)

  google.charts.load('current', {'packages': ['corechart']});

  const drawGraph = (timeInterval = 'hour') => {
    const animationLength = 6000

    const datatable = new google.visualization.DataTable()
    datatable.addColumn('date', 'Time')
    datatable.addColumn('number', 'Filing events')
    datatable.addColumn('number', 'Company events')
    const chartWrapper = new google.visualization.ChartWrapper({
      chartType: timeInterval === "minute" ? "ScatterChart" : "ColumnChart",
      dataTable: datatable,
      options: new GraphConfig({ animationLength, timeInterval }),
      containerId: "graph"
    })
    fetch('/generateGraphData?interval=' + timeInterval)
      .then(r => r.json())
      .then(j => {
        const drawInterval = setInterval(() => {
          chartWrapper.draw()
        }, animationLength / 10)
        setTimeout(() => {
          clearInterval(drawInterval)
          chartWrapper.draw()
        }, animationLength)
        j.forEach((row, index) => {
          const timeout = index / j.length * animationLength
          setTimeout(() => {
            if (row[timeInterval])
              datatable.addRow([new Date(row[timeInterval]), row.filing ? Number(row.filing) : undefined, row.company ? Number(row.company) : undefined])
          }, timeout)
        })
      })
      .then(() => chartWrapper.draw())
      .catch(e => console.log(e))

  }

  google.charts.setOnLoadCallback(drawGraph);
  google.charts.setOnLoadCallback(() => {
    let button = document.createElement('button')
    button.onclick = () => {
      drawGraph('month')
    }
    button.innerText = 'By Month'
    document.querySelector('body').insertAdjacentElement('afterbegin', button)
  });
  google.charts.setOnLoadCallback(() => {
    let button = document.createElement('button')
    button.onclick = () => {
      drawGraph('day')
    }
    button.innerText = 'By Day'
    document.querySelector('body').insertAdjacentElement('afterbegin', button)
  });
  google.charts.setOnLoadCallback(() => {
    let button = document.createElement('button')
    button.onclick = () => {
      drawGraph('hour')
    }
    button.innerText = 'By Hour'
    document.querySelector('body').insertAdjacentElement('afterbegin', button)
  });

  google.charts.setOnLoadCallback(() => {
    let button = document.createElement('button')
    button.onclick = () => {
      drawGraph('minute')
    }
    button.innerText = 'By Minute'
    document.querySelector('body').insertAdjacentElement('afterbegin', button)
  });
}
const attemptGoogle = setInterval(main, 50)
