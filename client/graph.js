google.charts.load('current', {'packages': ['corechart']});


const drawGraph = () => {
  const options = {
    height: document.getElementById('graph').clientHeight,
    legend: {position: 'none'},
    title: 'Filing events per second',
    vAxis: {minValue: 0},
    colors: ['darkgray'],
    backgroundColor: {
      fill: 'lightgrey',
      stroke: 'darkgray'
    },
    trendlines: {
      0: {
        type: 'polynomial',
        color: 'darkslategray',
      }
    },
    tooltip: {
      trigger: 'none'
    }
    // animation: {
    //     duration: 80,
    //     easing: 'in'
    // }
  }
  
  const datatable = new google.visualization.DataTable()
  datatable.addColumn('date', 'Time')
  datatable.addColumn('number', 'Events per second')
  const chartWrapper = new google.visualization.ChartWrapper({
    chartType: 'ScatterChart',
    dataTable: datatable,
    options: options,
    containerId: 'graph'
  })
  fetch('/graphdata')
    .then(r => r.json())
    .then(j => {
      j.forEach(row => {
        datatable.addRow([new Date(row.minute), Number(row.count) / 60])
        // chartWrapper.draw()
      })
    })
    .then(() => chartWrapper.draw())
    .catch(e => console.log(e))
  
  
  // chartWrapper.draw()
}

google.charts.setOnLoadCallback(drawGraph);
