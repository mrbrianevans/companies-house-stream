import { convertJsonSchemas } from "./getResourceSchema";

self.addEventListener("message", async (msg) => {
  switch (msg.data.type) {
    case "generate-language": {
      const { schemas, language } = msg.data;
      const output = await convertJsonSchemas(schemas, language);
      postMessage(output);
    }
  }
});
