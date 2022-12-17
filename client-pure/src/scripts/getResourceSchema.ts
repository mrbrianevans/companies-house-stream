const languages = ['go', 'typescript'] as const

export async function convertJsonSchemas(schemas, outputLanguage: typeof languages[number]){
  const {
    FetchingJSONSchemaStore,
    InputData,
    JSONSchemaInput,
    quicktype
  } = await import('quicktype-core')
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
  for (const resourceKind in schemas) {
    const schema = schemas[resourceKind]
    await schemaInput.addSource({ name: resourceKind, schema });
  }
  const inputData = new InputData();
  inputData.addInput(schemaInput);
  const output = await quicktype({
    inputData,
    lang: outputLanguage,
  });
  return output.lines.join('\n')
}
