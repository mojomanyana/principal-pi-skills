export interface Settings {
  host: string;
  port: number;
}

export function parseConfig(raw: string): Settings {
  const data = JSON.parse(raw);
  // crashes when 'host' is missing: undefined.trim() throws a TypeError
  return { host: data.host.trim(), port: data.port };
}
