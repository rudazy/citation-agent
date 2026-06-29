import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./path-alias-hook.mjs", pathToFileURL("./scripts/"));