import type { Detection } from "./types.js";

const CODES = {
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
} as const;

const RESET = "\u001b[0m";
const LABEL_WIDTH = 16;

export type StyleName = keyof typeof CODES;

export interface Ui {
  readonly verbose: boolean;
  style(name: StyleName, text: string): string;
}

function terminalSupportsColor(): boolean {
  return process.stderr.isTTY === true && process.env.NO_COLOR === undefined;
}

export function createUi(verbose: boolean, colorOverride?: boolean): Ui {
  const color = colorOverride ?? terminalSupportsColor();
  return {
    verbose,
    style(name, text) {
      return color && text.length > 0 ? `${CODES[name]}${text}${RESET}` : text;
    },
  };
}

export function header(ui: Ui, version: string, dir: string): string {
  return [
    ui.style("dim", "◇"),
    ui.style("bold", "flake-generate"),
    ui.style("dim", `v${version} · ${dir}`),
  ].join(" ");
}

export function detectionLine(ui: Ui, item: Detection): string {
  const lines = [
    `◆ ${ui.style("cyan", item.label.padEnd(LABEL_WIDTH))}${item.packages.join(", ")}`,
  ];
  if (ui.verbose) {
    lines.push(`  ${ui.style("dim", "markers".padEnd(LABEL_WIDTH))}${item.markers.join(", ")}`);
  }
  return lines.join("\n");
}

export function warning(ui: Ui, message: string): string {
  return `${ui.style("yellow", "! warning:")} ${message}`;
}

export function info(ui: Ui, message: string): string {
  return `${ui.style("cyan", "→")} ${message}`;
}

export function success(ui: Ui, message: string): string {
  return `${ui.style("green", "✓")} ${message}`;
}

export function summary(ui: Ui, text: string): string {
  return ui.style("dim", `  ${text}`);
}

export function colorizeDiff(ui: Ui, diff: string): string {
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
        return ui.style("dim", line);
      }
      if (line.startsWith("+")) return ui.style("green", line);
      if (line.startsWith("-")) return ui.style("red", line);
      return line;
    })
    .join("\n");
}

export function limitDiff(diff: string, maxLines: number): string {
  const lines = diff.split("\n");
  if (lines.length <= maxLines) return diff;
  const hidden = lines.length - maxLines;
  return `${lines.slice(0, maxLines).join("\n")}\n  … ${hidden} more lines (use --verbose)`;
}
