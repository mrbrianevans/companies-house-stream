const url =
  "https://raw.githubusercontent.com/companieshouse/api-enumerations/refs/heads/master/psc_descriptions.yml";

const res = await fetch(url);

const yaml = await res.text();

const data = Bun.YAML.parse(yaml);

await Bun.write(
  "../../../client-pure/src/assets/pscDescriptions.json",
  JSON.stringify(data, null, 2),
);
