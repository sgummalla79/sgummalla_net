import client from "./client";

export async function fetchDebugMode(): Promise<boolean> {
  try {
    const { data } = await client.get<{ enabled: boolean }>("/debug/mode");
    return data.enabled;
  } catch {
    return false;
  }
}

export async function setDebugMode(enabled: boolean): Promise<boolean> {
  const { data } = await client.post<{ enabled: boolean }>("/debug/mode", {
    enabled,
  });
  return data.enabled;
}
