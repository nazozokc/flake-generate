export const NODE_ATTRIBUTES: Readonly<Record<number, string>> = {
  22: "nodejs_22",
  24: "nodejs_24",
  26: "nodejs_26",
};

export const PYTHON_ATTRIBUTES: Readonly<Record<number, string>> = {
  11: "python311",
  12: "python312",
  13: "python313",
  14: "python314",
};

export const RUBY_ATTRIBUTES: Readonly<Record<number, string>> = {
  4: "ruby_3_4",
};

export const JDK_ATTRIBUTES: Readonly<Record<number, string>> = {
  8: "jdk8",
  11: "jdk11",
  17: "jdk17",
  21: "jdk21",
  25: "jdk25",
};

export const ELIXIR_ATTRIBUTES: Readonly<Record<number, string>> = {
  18: "beam27Packages.elixir_1_18",
  19: "beam27Packages.elixir_1_19",
};

export function firstLine(value: string | undefined): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
}

export function majorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/v?(\d+)(?:\.\d+)*/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function pythonMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/^3\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function rubyMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/^3\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function elixirMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/elixir:\s*["']~?>\s*\d+\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
