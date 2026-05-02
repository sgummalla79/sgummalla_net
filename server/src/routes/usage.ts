import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireOwner } from "../middleware/requireOwner.js";
import { loggedFetch } from "../lib/logger.js";
import sql from "../lib/db.js";
import { getDb } from "../lib/firebase.js";

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

      // Storage + live row counts from PostgreSQL stats (no full table scan)
      const tables = await sql<
        {
          table_name: string;
          total_bytes: string;
          table_bytes: string;
          index_bytes: string;
          row_count: string;
        }[]
      >`
        SELECT
          c.relname                            AS table_name,
          pg_total_relation_size(c.oid)::text  AS total_bytes,
          pg_relation_size(c.oid)::text        AS table_bytes,
          pg_indexes_size(c.oid)::text         AS index_bytes,
          COALESCE(s.n_live_tup, 0)::text      AS row_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname AND s.schemaname = 'public'
        WHERE c.relkind = 'r' AND n.nspname = 'public'
        ORDER BY pg_total_relation_size(c.oid) DESC
      `;

      // 7-day daily insert activity for tables that have a timestamp column
      const [articlesAct, sfClientsAct, sfTokensAct, userTokensAct] =
        await Promise.all([
          sql<{ day: string; count: string }[]>`
          SELECT DATE_TRUNC('day', created_at)::date::text AS day, COUNT(*)::text AS count
          FROM articles WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
          sql<{ day: string; count: string }[]>`
          SELECT DATE_TRUNC('day', created_at)::date::text AS day, COUNT(*)::text AS count
          FROM sf_clients WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
          sql<{ day: string; count: string }[]>`
          SELECT DATE_TRUNC('day', issued_at)::date::text AS day, COUNT(*)::text AS count
          FROM sf_tokens WHERE issued_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
          sql<{ day: string; count: string }[]>`
          SELECT DATE_TRUNC('day', updated_at)::date::text AS day, COUNT(*)::text AS count
          FROM user_id_tokens WHERE updated_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
        ]);

      const toActivity = (rows: { day: string; count: string }[]) =>
        rows.map((r) => ({ day: r.day, count: Number(r.count) }));

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
          rowCount: Number(t.row_count),
        })),
        activity: [
          {
            table: "articles",
            label: "Articles",
            color: "#60a5fa",
            days: toActivity(articlesAct),
          },
          {
            table: "sf_clients",
            label: "SF Clients",
            color: "#34d399",
            days: toActivity(sfClientsAct),
          },
          {
            table: "sf_tokens",
            label: "SF Tokens",
            color: "#f59e0b",
            days: toActivity(sfTokensAct),
          },
          {
            table: "user_id_tokens",
            label: "User ID Tokens",
            color: "#a78bfa",
            days: toActivity(userTokensAct),
          },
        ],
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

// ── GET /api/usage/firestore ──────────────────────────────────────────────────

const COLLECTIONS = [
  { name: "api_logs", label: "API Logs", ttl: "30 days" },
  { name: "page_views", label: "Page Views", ttl: "1 year" },
  { name: "auth_events", label: "Auth Events", ttl: "90 days" },
  { name: "sf_ops", label: "SF Ops", ttl: "90 days" },
];

const FREE_WRITES_PER_DAY = 20_000;
const FS_PROJECT_ID       = "sgummallaworks";

router.get("/firestore", async (_req: Request, res: Response) => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    res.status(503).json({ error: "FIREBASE_SERVICE_ACCOUNT not configured" });
    return;
  }

  try {
    const data = await cached("firestore", 5 * 60 * 1000, async () => {
      const db = getDb();
      const { Timestamp } = await import("firebase-admin/firestore");

      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (6 - i)));
        return { label: d.toISOString().slice(0, 10), start: d, end: new Date(d.getTime() + 86_400_000) };
      });

      // Collection document counts + 7-day creation activity
      const counts = await Promise.all(
        COLLECTIONS.map(async (col) => {
          let count: number | null = null;
          try {
            count = (await db.collection(col.name).count().get()).data().count;
          } catch { /* empty */ }

          const activity = await Promise.all(
            last7Days.map(async ({ label, start, end }) => {
              try {
                const snap = await db.collection(col.name)
                  .where("createdAt", ">=", Timestamp.fromDate(start))
                  .where("createdAt", "<",  Timestamp.fromDate(end))
                  .count().get();
                return { day: label, count: snap.data().count };
              } catch {
                return { day: label, count: 0 };
              }
            }),
          );

          return { ...col, count, activity };
        }),
      );

      const totalDocuments = counts.reduce((sum, c) => sum + (c.count ?? 0), 0);

      // Daily writes = sum of document creates across all collections per day
      // (creates are the dominant write type for this app's logging pattern)
      const dailyWrites = last7Days.map(({ label: day }) => ({
        day,
        count: counts.reduce((sum, col) => {
          const a = col.activity.find(d => d.day === day);
          return sum + (a?.count ?? 0);
        }, 0),
      }));

      return {
        projectId: FS_PROJECT_ID,
        consoleUrl: `https://console.firebase.google.com/project/${FS_PROJECT_ID}/firestore`,
        collections: counts,
        totalDocuments,
        dailyWrites,
        freeTier: {
          writesPerDay: FREE_WRITES_PER_DAY,
        },
      };
    });

    res.json(data);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch Firestore usage";
    res.status(500).json({ error: msg });
  }
});

export default router;
