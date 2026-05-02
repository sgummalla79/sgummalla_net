import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireOwner } from "../middleware/requireOwner.js";
import { loggedFetch } from "../lib/logger.js";
import sql from "../lib/db.js";

const router: import("express").Router = Router();
router.use(requireAuth, requireOwner);

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data);
  return fn().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// ── GET /api/usage/neon ───────────────────────────────────────────────────────

const NEON_FREE_LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB free tier

router.get("/neon", async (_req: Request, res: Response) => {
  try {
    const data = await cached("neon", 5 * 60 * 1000, async () => {
      const [sizeRow] = await sql<{ bytes: string }[]>`
        SELECT pg_database_size(current_database()) AS bytes
      `;

      const tables = await sql<
        {
          table_name: string;
          total_bytes: string;
          table_bytes: string;
          index_bytes: string;
        }[]
      >`
        SELECT
          c.relname                            AS table_name,
          pg_total_relation_size(c.oid)::text  AS total_bytes,
          pg_relation_size(c.oid)::text        AS table_bytes,
          pg_indexes_size(c.oid)::text         AS index_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public'
        ORDER BY pg_total_relation_size(c.oid) DESC
      `;

      const usedBytes = Number(sizeRow.bytes);

      return {
        usedBytes,
        limitBytes: NEON_FREE_LIMIT_BYTES,
        usedPercent: Math.round((usedBytes / NEON_FREE_LIMIT_BYTES) * 100),
        tables: tables.map((t) => ({
          name: t.table_name,
          totalBytes: Number(t.total_bytes),
          tableBytes: Number(t.table_bytes),
          indexBytes: Number(t.index_bytes),
        })),
      };
    });

    res.json(data);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch Neon usage";
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/usage/fly ────────────────────────────────────────────────────────

const FLY_PROM_BASE = `https://api.fly.io/prometheus/${process.env.FLY_ORG_SLUG ?? "suman-gummalla"}`;
const FLY_APP = process.env.FLY_APP_NAME ?? "sgummalla-net";

async function promQuery(metric: string): Promise<number | null> {
  const token = process.env.FLY_API_TOKEN;
  if (!token) return null;
  try {
    const url = `${FLY_PROM_BASE}/api/v1/query?query=${encodeURIComponent(metric)}`;
    const res = await loggedFetch(
      url,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      `Fly.io Prometheus — ${metric}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: { result: Array<{ value: [number, string] }> };
    };
    const result = json.data?.result?.[0];
    return result ? parseFloat(result.value[1]) : null;
  } catch {
    return null;
  }
}

router.get("/fly", async (_req: Request, res: Response) => {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "FLY_API_TOKEN not configured" });
    return;
  }

  try {
    const data = await cached("fly", 60 * 1000, async () => {
      const app = FLY_APP;
      const [cpuUser, memTotal, memAvailable, netSent, netRecv, httpCount] =
        await Promise.all([
          promQuery(
            `avg(rate(fly_instance_cpu{app="${app}",state="user"}[5m])) * 100`,
          ),
          promQuery(`avg(fly_instance_memory_mem_total{app="${app}"})`),
          promQuery(`avg(fly_instance_memory_mem_available{app="${app}"})`),
          promQuery(
            `sum(increase(fly_instance_net_sent_bytes{app="${app}"}[24h]))`,
          ),
          promQuery(
            `sum(increase(fly_instance_net_recv_bytes{app="${app}"}[24h]))`,
          ),
          promQuery(
            `sum(increase(fly_edge_http_responses_count{app="${app}"}[24h]))`,
          ),
        ]);

      const memUsed =
        memTotal != null && memAvailable != null
          ? memTotal - memAvailable
          : null;

      return {
        app,
        billingUrl: `https://fly.io/dashboard/${process.env.FLY_ORG_SLUG ?? "suman-gummalla"}/billing`,
        cpu: {
          userPercent: cpuUser != null ? Math.round(cpuUser * 10) / 10 : null,
        },
        memory: {
          usedBytes: memUsed != null ? Math.round(memUsed) : null,
          totalBytes: memTotal != null ? Math.round(memTotal) : null,
        },
        network: {
          sentBytes24h: netSent != null ? Math.round(netSent) : null,
          recvBytes24h: netRecv != null ? Math.round(netRecv) : null,
        },
        http: {
          requests24h: httpCount != null ? Math.round(httpCount) : null,
        },
      };
    });

    res.json(data);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch Fly.io usage";
    res.status(500).json({ error: msg });
  }
});

export default router;
