import { FetchingJSONSchemaStore, InputData, JSONSchemaInput, quicktype } from "quicktype-core"
import { languages } from "./streamPaths"

export async function convertJsonSchemas(schemas, outputLanguage: typeof languages[number]) {
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore())
  for (const resourceKind in schemas) {
    const schema = JSON.stringify(schemas[resourceKind])
    await schemaInput.addSource({ name: resourceKind, schema })
  }
  const inputData = new InputData()
  inputData.addInput(schemaInput)
  const output = await quicktype({
    inputData,
    lang: outputLanguage, debugPrintTimes: true
  });
  return output.lines.join('\n')
}
