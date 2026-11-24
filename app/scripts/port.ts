// Prints this checkout's base port, for package.json scripts (`-p $(bun ./scripts/port.ts)`):
// bun hands app/.env.local to child processes but not to the script line itself
import { getBasePort } from "../src/lib/dev-port";

process.stdout.write(`${getBasePort()}\n`);
