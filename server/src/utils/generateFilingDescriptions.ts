const url =
  "https://raw.githubusercontent.com/companieshouse/api-enumerations/refs/heads/master/filing_history_descriptions.yml";

const res = await fetch(url);

const yaml = await res.text();

const data = Bun.YAML.parse(yaml) as { description: Record<string, string> };

const descriptions = data.description;

descriptions.legacy = "{description}";

await Bun.write(
  "../../../client-pure/src/assets/filingDescriptions.json",
  JSON.stringify(descriptions, null, 2),
);
