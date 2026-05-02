import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../firebase.js";
import type { LogRecord } from "../logTypes.js";
import { LogRecordType } from "../logTypes.js";
import type { LogSink } from "../logTypes.js";

// ── TTL config (ms) ───────────────────────────────────────────────────────────

const TTL: Record<string, number> = {
  api_logs: 30 * 24 * 60 * 60 * 1000, // 30 days
  page_views: 365 * 24 * 60 * 60 * 1000, // 1 year
  auth_events: 90 * 24 * 60 * 60 * 1000, // 90 days
  sf_ops: 90 * 24 * 60 * 60 * 1000, // 90 days
};

function collectionFor(logType: LogRecordType): string {
  switch (logType) {
    case LogRecordType.APIIN:
    case LogRecordType.APIOUT:
    case LogRecordType.APPERROR:
      return "api_logs";
    case LogRecordType.PAGEVIEW:
    case LogRecordType.BLOGVIEW:
    case LogRecordType.ARTVIEW:
      return "page_views";
    case LogRecordType.AUTHEVENT:
      return "auth_events";
    case LogRecordType.SFOP:
      return "sf_ops";
  }
}

export class FirestoreSink implements LogSink {
  name = "firestore";

  async write(record: LogRecord): Promise<void> {
    const collection = collectionFor(record.logType);
    const ttlMs = TTL[collection] ?? TTL["api_logs"];
    const expireAt = Timestamp.fromDate(new Date(Date.now() + ttlMs));

    const doc = {
      ...record,
      timestamp: Timestamp.fromDate(record.timestamp),
      createdAt: Timestamp.fromDate(record.createdAt),
      expireAt,
    };

    await getDb().collection(collection).add(doc);
  }
}
