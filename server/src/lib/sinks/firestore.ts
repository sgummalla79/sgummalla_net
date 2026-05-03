import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../firebase.js";
import type { LogRecord } from "../logTypes.js";
import type { LogSink } from "../logTypes.js";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class FirestoreSink implements LogSink {
  name = "firestore";

  async write(record: LogRecord): Promise<void> {
    const expireAt = Timestamp.fromDate(new Date(Date.now() + TTL_MS));
    await getDb().collection("logs").add({
      ...record,
      timestamp: Timestamp.fromDate(record.timestamp),
      createdAt: Timestamp.fromDate(record.createdAt),
      expireAt,
    });
  }
}
