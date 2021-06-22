//--------------------MAPPING-----------------------------------------
let map = L.map("map", {
  zoomControl: false,
  dragging: false,
  boxZoom: false,
  doubleClickZoom: false,
  scrollWheelZoom: false,
  zoom: 6,
  center: [
    54.79423338834616,
    -4.3943643972436695
  ]
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
  subdomains: ["a", "b", "c"]
}).addTo(map);
const mapMarker = () => {
  const size = 40; // pixels x pixels width and height of the marker pin
  return L.icon({
    iconUrl: "mapMarker.svg",
    iconAnchor: [size / 2, size],
    iconSize: [size, size],
    className: "mapMarker"
  });
};
const getCompanyProfile = async (companyNumber) => {
  const companyProfile = await fetch(functionUrl + companyNumber).then(async r => {
    if (r.status === 200)
      return r.json();
    console.error((await r.json()).message);
    return null;
  }).catch(console.error);
  if (!companyProfile) return null;
  const point = L.marker([companyProfile.lat, companyProfile.long], { interactive: false, icon: mapMarker() });
  point.addTo(map);
  setTimeout(() => {
    point.remove();
  }, 5000);
  return companyProfile;
};
// ---------- GRAPH ----------------------------------
const getBorderColour = (d, i) => {
  const colours = [
    "rgba(255, 99, 132, 1)",
    "rgba(54, 162, 235, 1)",
    "rgba(255, 206, 86, 1)",
    "rgba(75, 192, 192, 1)",
    "rgba(153, 102, 255, 1)",
    "rgba(255, 159, 64, 1)"
  ];
  return colours[i % colours.length];
};
const getBackgroundColour = (d, i) => {
  const colours = [
    "rgba(255, 99, 132, 0.2)",
    "rgba(54, 162, 235, 0.2)",
    "rgba(255, 206, 86, 0.2)",
    "rgba(75, 192, 192, 0.2)",
    "rgba(153, 102, 255, 0.2)",
    "rgba(255, 159, 64, 0.2)"
  ];
  return colours[i % colours.length];
};
const ctx = document.getElementById("graph").getContext("2d");
const numberOfBars = 20;
const chart = new Chart(ctx, {
  type: "bar",
  data: {
    labels: Array(numberOfBars).fill(Date.now()).map((d, i) => new Date(d - i * 60_000).toLocaleTimeString().slice(0, 5)),
    datasets: [{
      label: "Feature coming soon...",
      data: Array(numberOfBars).fill(0),
      backgroundColor: Array(numberOfBars).fill(0).map(getBackgroundColour),
      borderColor: Array(numberOfBars).fill(0).map(getBorderColour),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: "y",
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
});

setInterval(() => {
  chart.data.datasets[0].data[Math.round(Math.random() * chart.data.datasets[0].data.length)] += Math.round(Math.random() * 10);
  chart.update();
}, 1000);

// ---------- EVENTS --------------------------------
const socket = io();
let connected = false;
document.querySelector("#clock").innerHTML = new Date().toLocaleTimeString();
const setConnected = (bool) => {
  connected = bool;
  document.querySelector("#connection-status").innerHTML = connected ? "Connected" : "Disconnected";
  document.querySelector("#connection-status").className = connected ? "connected" : "disconnected";
  document.querySelector("#connection-status").onclick = () => {
    console.log("Button pressed, connection:", connected);
    if (connected)
      socket.close();
    else
      socket.connect();
  };
};

const pushEvent = async (e) => {
  document.querySelector("#notification-counter").innerHTML = (Number(document.querySelector("#notification-counter").innerHTML) + 1).toString();
  const eventCard = document.createElement("div");
  switch (e.resource_kind || e.source) {
    case "company-profile": // layout for company profile change card
      eventCard.innerHTML = await companyProfileCard(e);
      break;
    case "filing-history":
      eventCard.innerHTML = await filingHistoryCard(e);
      break;
    case "company-charges":
      eventCard.innerHTML = await chargesCard(e);
      break;
    case "company-insolvency":
      eventCard.innerHTML = await insolvencyCard(e);
      break;
    default:
      eventCard.innerHTML = `
        <div class="alert"><h3>New format of event!</h3>
        <p>${e.resource_kind}</p></div>
        `;
      break;
  }

  let events = document.querySelector("#events");
  if (events.childElementCount === 15) events.removeChild(events.lastChild);
  events.insertAdjacentElement("afterbegin", eventCard);
};
const heartbeat = () => {
  const eventCard = document.createElement("div");
  eventCard.innerHTML = "<div class='heart-outer'><div class='heart1'></div><div class='heart2'></div><div class='heart3'></div></div>";
  eventCard.className = "heartbeat";
  let events = document.querySelector("#events");
  if (events.childElementCount === 15) events.removeChild(events.lastChild);
  events.insertAdjacentElement("afterbegin", eventCard);
};
socket.on("connect", () => {
  setConnected(true);

  socket.on("disconnect", () => {
    setConnected(false);
    clearInterval(clock);
  });
  const clock = setInterval(() => {
    document.querySelector("#clock").innerHTML = new Date().toLocaleTimeString();
  }, 1000);
});

socket.on("event", pushEvent);
socket.on("heartbeat", heartbeat);

const functionUrl = "/getCompanyInfo?company_number=";
const filingHistoryCard = async (event) => {
  const companyNumber = event.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/filing-history/)[1];
  const companyProfile = await getCompanyProfile(companyNumber);
  const description = await fetch("/getFilingDescription", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      description: event.data.description,
      description_values: event.data.description_values
    })
  }).then(j => j.json()).then(j => j.formattedDescription).catch(console.error);
  const e = {
    companyNumber,
    companyProfile,
    description: description ?? event.data.description,
    published: new Date(event.event.published_at),
    resource_kind: event.resource_kind,
    source: event.resource_kind,
    title: event.data.category
  };
  return `
      <div class="filing-card">
    <div class="row">
      <h3>${e.companyProfile?.name || e.companyNumber}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
    </div>
    <p>${e.description}</p>
    <p>${e.title} published at ${e.published.toLocaleTimeString()}</p>
    </div>
        `;
};


const companyProfileCard = async (event) => {
  const companyNumber = event.data.company_number;
  // const companyProfile = await fetch(functionUrl+companyNumber).then(r=>r.json())
  const newCompany = (new Date(event.data.date_of_creation).valueOf() > Date.now() - 86400000);
  return `<div class="companies-card"><div class="row">
      <h3>${event.data.company_name}</h3>
      <sub><code><a href="https://filterfacility.co.uk/company/${event.data.company_number}" target="_blank">${event.data.company_number}</a></code></sub>
    </div>
    <p class="new-company">${newCompany ? "New company" : ""} ${event.event.fields_changed ? event.event.fields_changed.join(", ") : ""}</p>
    <p>${event.event.type} ${event.resource_kind} at ${new Date(event.event.published_at).toLocaleTimeString()}</p>
    </div>`;
};

const chargesCard = async (event) => {
  const [, companyNumber] = event.resource_uri.match(/^\/company\/([A-Z0-9]{6,8})\/charges/);
  const companyProfile = await getCompanyProfile(companyNumber);
  return `
        <div class="charges-card"><h3>${companyProfile?.name ?? companyNumber}
        <sub><code><a href="https://filterfacility.co.uk/company/${companyNumber}" target="_blank">${companyNumber}</a></code></sub>
        </h3>
        <p>${event.data.classification.description}</p>
        <p>Charge published at ${new Date(event.event.published_at).toLocaleTimeString()}</p>
        </div>
      `;
};
const insolvencyCard = async (event) => {
  const companyNumber = event.resource_id;
  const companyProfile = await getCompanyProfile(companyNumber);
  return `
        <div class="insolvency-card"><h3>Insolvency: ${companyProfile?.name ?? companyNumber}
        <sub><code><a href="https://filterfacility.co.uk/company/${event.resource_id}" target="_blank">${event.resource_id}</a></code></sub>
        </h3><p>${event.data.cases[0].type}</p>
        <p>Published at ${new Date(event.event.published_at).toLocaleTimeString()}</p>
        </div>
        `;
};

