const main = () => {
  console.log("Running main")
  if (typeof google === 'undefined') return
  else clearInterval(attemptGoogle)
  
  google.charts.load('current', {'packages': ['corechart']});
  
  
  const drawGraph = (timeInterval = 'minute') => {
    const options = {
      height: document.getElementById('graph').clientHeight * 0.98,
      legend: {position: 'top'},
      title: 'Events per ' + timeInterval,
      vAxis: {minValue: 0},
      colors: ['darkgray', 'bisque'],
      backgroundColor: {
        fill: 'aliceblue',
        stroke: 'blue'
      },
      tooltip: {
        trigger: 'none'
      },
      animation: {
        duration: 900,
        easing: 'in-out'
      },
      crosshair: {trigger: "both", orientation: "both"},
      // trendlines:{
      //   0:{
      //     type: "polynomial",
      //     degree: 3,
      //     color: "darkslategrey"
      //   }
      // }
    }
    
    const datatable = new google.visualization.DataTable()
    datatable.addColumn('date', 'Time')
    datatable.addColumn('number', 'Filing events')
    datatable.addColumn('number', 'Company events')
    const chartWrapper = new google.visualization.ChartWrapper({
      chartType: 'ScatterChart',
      dataTable: datatable,
      options: options,
      containerId: 'graph'
    })
    
    fetch('/graphdata?interval=' + timeInterval)
      .then(r => r.json())
      .then(j => {
        const drawInterval = setInterval(() => {
          chartWrapper.draw()
        }, 1000)
        setTimeout(() => {
          clearInterval(drawInterval)
          chartWrapper.draw()
        }, 10000)
        j.forEach((row, index) => {
          const timeout = index / j.length * 10000
          setTimeout(() => {
            datatable.addRow([new Date(row[timeInterval]), Number(row.filing), Number(row.company)])
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
