import "../styles/theme.scss";
import "../styles/samples.scss";
import "../styles/events.scss";

import { languages, streamPaths } from "../scripts/streamPaths";
import { downloadSampleEvents, getSampleEvents } from "../scripts/downloadSampleEvents";
import { generateLanguageSchemaInWorker } from "../scripts/schemaWorkerWrapper";

// run when samples page is loaded
function initSamplesPage() {
  {
    // downloads
    const container = document.getElementById("download-streams-container");

    const qtyLabel = document.createElement("label");
    qtyLabel.innerText = "Qty: ";
    const qtyBox = document.createElement("input");
    qtyBox.value = "100";
    qtyLabel.appendChild(qtyBox);
    container.appendChild(qtyLabel);
    for (const streamPath of streamPaths) {
      const downloadButton = document.createElement("button");
      downloadButton.innerText = "Download " + streamPath + " samples";
      downloadButton.className = streamPath;
      downloadButton.addEventListener("click", () =>
        downloadSampleEvents(streamPath, parseInt(qtyBox.value) || 10),
      );
      container.appendChild(downloadButton);
    }
  }

  {
    // view
    const container = document.getElementById("view-streams-container");
    const viewer = document.getElementById("view-samples");
    const description = document.getElementById("sample-description");
    for (const streamPath of streamPaths) {
      const viewButton = document.createElement("button");
      viewButton.innerText = "View " + streamPath + " sample";
      viewButton.className = streamPath;
      viewButton.addEventListener("click", () =>
        getSampleEvents(streamPath, 1).then((r) => {
          if (r.length) {
            const { received, ...event } = r[0];
            viewer.innerText = JSON.stringify(event, null, 2);
            description.innerText =
              "Event received on " +
              streamPath +
              " stream at " +
              new Date(received).toISOString() +
              ".";
          } else {
            description.innerText = `This server hasn't received any events on the ${streamPath} stream yet.`;
          }
        }),
      );
      container.appendChild(viewButton);
    }
  }

  {
    // schemas
    const container = document.getElementById("schemas-container");
    const viewer = document.getElementById("view-schema");
    const description = document.getElementById("schema-description");
    fetch("/events/schemas")
      .then((r) => r.json())
      .then((schemas) => {
        for (const schema in schemas) {
          const viewButton = document.createElement("button");
          viewButton.innerText = "View " + schema + " schema";
          viewButton.addEventListener("click", () => {
            viewer.innerText = JSON.stringify(schemas[schema], null, 2);
            description.innerText = "Schema for " + schema;
          });
          container.appendChild(viewButton);
        }

        const languagePicker = document.createElement("select");
        for (const language of languages) {
          const languageOption = document.createElement("option");
          languageOption.innerText = language;
          languagePicker.appendChild(languageOption);
        }
        container.appendChild(languagePicker);

        const convertButton = document.createElement("button");
        convertButton.innerText = "Convert schemas to language";
        convertButton.addEventListener("click", async () => {
          const output = await generateLanguageSchemaInWorker(
            schemas,
            languagePicker.value as (typeof languages)[number],
          );
          viewer.innerText = String(output);
          description.innerText = languagePicker.value + "schemas";
        });
        container.appendChild(convertButton); // this is currently disabled because of a bug in quicktype causing an error
      });
  }
}

initSamplesPage();
