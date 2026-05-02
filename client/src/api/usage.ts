import client from "./client";

// ── Shared ────────────────────────────────────────────────────────────────────

export interface DailyCount {
  day: string;
  count: number;
}

// ── Neon ──────────────────────────────────────────────────────────────────────

export interface NeonTable {
  name: string;
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
  rowCount: number;
}

export interface NeonActivitySeries {
  table: string;
  label: string;
  color: string;
  days: DailyCount[];
}

export interface NeonUsage {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  tables: NeonTable[];
  activity: NeonActivitySeries[];
}

// ── Fly.io ────────────────────────────────────────────────────────────────────

export interface FlyUsage {
  app: string;
  billingUrl: string;
  cpu: { userPercent: number | null };
  memory: { usedBytes: number | null; totalBytes: number | null };
  network: { sentBytes24h: number | null; recvBytes24h: number | null };
  http: { requests24h: number | null };
}

// ── Firestore ─────────────────────────────────────────────────────────────────

export interface FirestoreCollection {
  name: string;
  label: string;
  ttl: string;
  count: number | null;
  activity: DailyCount[];
}

export interface FirestoreUsage {
  projectId:      string;
  consoleUrl:     string;
  collections:    FirestoreCollection[];
  totalDocuments: number;
  dailyWrites:    DailyCount[];
  freeTier: {
    writesPerDay: number;
  };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchNeonUsage(): Promise<NeonUsage> {
  const { data } = await client.get<NeonUsage>("/usage/neon");
  return data;
}

export async function fetchFlyUsage(): Promise<FlyUsage> {
  const { data } = await client.get<FlyUsage>("/usage/fly");
  return data;
}

export async function fetchFirestoreUsage(): Promise<FirestoreUsage> {
  const { data } = await client.get<FirestoreUsage>("/usage/firestore");
  return data;
}
