export class GraphConfig {
  timeInterval;
  animationLength;

  constructor({ timeInterval, animationLength }) {
    return {
      height: document.getElementById("graph").clientHeight * 0.98,
      legend: { position: "top" },
      title: "Events per " + timeInterval,
      vAxis: { minValue: 0 },
      colors: ["darkgray", "bisque"],
      backgroundColor: {
        fill: "aliceblue",
        stroke: "blue"
      },
      tooltip: {
        trigger: "none"
      },
      animation: {
        duration: 0.1 * animationLength - 80,
        easing: "linear"
      },
      crosshair: { trigger: "both", orientation: "both" }
    };
  }

}