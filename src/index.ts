#!/usr/bin/env node
import { CommanderError } from "commander";
import { createProgram } from "./cli.js";

createProgram()
  .parseAsync(process.argv)
  .catch((error: unknown) => {
    if (error instanceof CommanderError) {
      if (error.exitCode !== 0) process.exitCode = 2;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`flake-generate: ${message}\n`);
    process.exitCode = 1;
  });
