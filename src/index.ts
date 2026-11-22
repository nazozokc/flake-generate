#!/usr/bin/env node
import { CliError, run } from "./cli.js";
import { createUi } from "./ui.js";

const ui = createUi(false);

run(process.argv.slice(2))
  .then((code: number) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof CliError) {
      process.stderr.write(`flake-generate: ${ui.style("red", error.message)}\n`);
      if (error.hint !== undefined) {
        process.stderr.write(`${ui.style("cyan", "  →")} ${error.hint}\n`);
      }
      process.stderr.write(`Try ${ui.style("bold", "flake-generate --help")} for usage.\n`);
      process.exitCode = 2;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`flake-generate: ${message}\n`);
    process.exitCode = 1;
  });
