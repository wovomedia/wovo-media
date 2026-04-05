export function sanitizeEnvValue(value: string | undefined | null): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function getEnv(name: string): string {
  return sanitizeEnvValue(process.env[name]);
}

export function getEnvAny(names: string[]): string {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return "";
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function requireEnvAny(names: string[]): string {
  const value = getEnvAny(names);
  if (!value) {
    throw new Error(`Missing one of: ${names.join(", ")}`);
  }
  return value;
}
