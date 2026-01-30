/*
the schema generator is wrapped in a worker so that:
 1. all the processing happens outside the main thread
 2. all the dependencies (mostly quicktype) are only loaded when this operation is performed
 */

export async function generateLanguageSchemaInWorker(schemas, language) {
  const worker = new Worker(new URL("./schemasWorker.ts", import.meta.url), {
    type: "module",
  });
  worker.postMessage({ type: "generate-language", schemas, language });
  const output = await new Promise((resolve, reject) =>
    worker.addEventListener("message", (e) => resolve(e.data)),
  );
  worker.terminate();
  return output;
}
