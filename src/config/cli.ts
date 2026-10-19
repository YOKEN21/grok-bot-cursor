import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./schema.js";
import { validateServiceConfig } from "./validate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "contracts/service-config.schema.json");
const configPath = path.join(root, "services/matter/matter-search/config.json");

const schema = readJson(schemaPath);
const config = readJson(configPath);
if (typeof schema !== "object" || schema === null) {
  console.error("service config schema must be a JSON object");
  process.exitCode = 1;
} else {
  const result = validateServiceConfig(schema, config);
  if (!result.ok) {
    console.error(`invalid service config: ${configPath}`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log("config ok");
  }
}
