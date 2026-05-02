import client from "./client";

export interface NeonTable {
  name: string;
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
}

export interface NeonUsage {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  tables: NeonTable[];
}

export interface FlyUsage {
  app: string;
  billingUrl: string;
  cpu: { userPercent: number | null };
  memory: { usedBytes: number | null; totalBytes: number | null };
  network: { sentBytes24h: number | null; recvBytes24h: number | null };
  http: { requests24h: number | null };
}

export async function fetchNeonUsage(): Promise<NeonUsage> {
  const { data } = await client.get<NeonUsage>("/usage/neon");
  return data;
}

export async function fetchFlyUsage(): Promise<FlyUsage> {
  const { data } = await client.get<FlyUsage>("/usage/fly");
  return data;
}
