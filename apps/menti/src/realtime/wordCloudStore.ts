import mongoose from "mongoose";
import { Response, Slide } from "../core/database/models/index.js";


export interface WordCloudWord {
  text: string;
  value: number;
}

export interface WordCloudSnapshot {
  words: WordCloudWord[];
  totalWords: number;
  uniqueWords: number;
}

interface Bucket {
  counts: Map<string, number>;
  display: Map<string, string>;
  totalWords: number;
  version: number;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  hydrationCutoff: Date | null;
  lastAccessAt: number;
  lastPersistedVersion: number;
  lastPersistAt: number;
  snapshotCache: { version: number; limit: number; snapshot: WordCloudSnapshot } | null;
}
const MAX_SLIDES = 250;
const MAX_UNIQUE_WORDS = 4000;
const PRUNE_TO = 2500;
const PERSIST_MIN_INTERVAL_MS = 10_000;

function normalize(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

class WordCloudStore {
  private buckets = new Map<string, Bucket>();

  private createBucket(): Bucket {
    return {
      counts: new Map(),
      display: new Map(),
      totalWords: 0,
      version: 0,
      hydrated: false,
      hydrating: null,
      hydrationCutoff: null,
      lastAccessAt: Date.now(),
      lastPersistedVersion: -1,
      lastPersistAt: 0,
      snapshotCache: null,
    };
  }

  private getBucket(slideId: string): Bucket {
    const key = slideId.toString();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.createBucket();
      this.buckets.set(key, bucket);
      this.evictIfNeeded();
    }
    bucket.lastAccessAt = Date.now();
    return bucket;
  }

  private evictIfNeeded(): void {
    if (this.buckets.size <= MAX_SLIDES) return;
    // Drop the least recently touched slides.
    const entries = [...this.buckets.entries()].sort(
      (a, b) => a[1].lastAccessAt - b[1].lastAccessAt,
    );
    const dropCount = this.buckets.size - MAX_SLIDES;
    for (let i = 0; i < dropCount; i++) {
      this.buckets.delete(entries[i]![0]);
    }
  }

  private async ensureHydrated(slideId: string): Promise<Bucket> {
    const bucket = this.getBucket(slideId);
    if (bucket.hydrated) return bucket;

    if (bucket.hydrating) {
      await bucket.hydrating;
      return bucket;
    }

    bucket.hydrating = this.hydrate(slideId, bucket).finally(() => {
      bucket.hydrating = null;
    });
    await bucket.hydrating;
    return bucket;
  }

  private async hydrate(slideId: string, bucket: Bucket): Promise<void> {
    const cutoff = new Date();

    try {
      const agg = await Response.aggregate([
        {
          $match: {
            slideId: new mongoose.Types.ObjectId(slideId.toString()),
            submittedAt: { $lte: cutoff },
          },
        },
        { $unwind: "$answer.raw" },
        {
          $project: {
            raw: "$answer.raw",
            clean: { $trim: { input: { $toLower: "$answer.raw" } } },
          },
        },
        { $match: { clean: { $ne: "" } } },
        { $group: { _id: "$clean", value: { $sum: 1 }, text: { $first: "$raw" } } },
        { $sort: { value: -1 } },
        { $limit: MAX_UNIQUE_WORDS },
      ]);

      for (const row of agg) {
        const key = normalize(String(row._id ?? ""));
        if (!key) continue;
        bucket.counts.set(key, row.value);
        bucket.display.set(key, String(row.text ?? row._id).trim());
        bucket.totalWords += row.value;
      }
    } catch (error: any) {
      console.error(`[WordCloudStore] Hydration failed for slide ${slideId}:`, error.message);
    }

    bucket.hydrationCutoff = cutoff;
    bucket.hydrated = true;
    bucket.version++;
    bucket.snapshotCache = null;
  }

  async ingest(slideId: string, words: string[], submittedAt: Date): Promise<void> {
    if (!slideId || !words.length) return;

    const bucket = await this.ensureHydrated(slideId);
    if (bucket.hydrationCutoff && submittedAt.getTime() <= bucket.hydrationCutoff.getTime()) {
      return;
    }

    let mutated = false;
    for (const raw of words) {
      const key = normalize(raw);
      if (!key) continue;
      bucket.counts.set(key, (bucket.counts.get(key) ?? 0) + 1);
      if (!bucket.display.has(key)) bucket.display.set(key, raw.trim());
      bucket.totalWords++;
      mutated = true;
    }

    if (!mutated) return;
    bucket.version++;
    bucket.snapshotCache = null;

    if (bucket.counts.size > MAX_UNIQUE_WORDS) this.prune(bucket);
  }

  /** Keep only the most frequent PRUNE_TO words; the tail is never rendered. */
  private prune(bucket: Bucket): void {
    const sorted = [...bucket.counts.entries()].sort((a, b) => b[1] - a[1]);
    const keep = sorted.slice(0, PRUNE_TO);
    const counts = new Map<string, number>();
    const display = new Map<string, string>();
    for (const [key, value] of keep) {
      counts.set(key, value);
      const shown = bucket.display.get(key);
      if (shown) display.set(key, shown);
    }
    bucket.counts = counts;
    bucket.display = display;
  }

  /** Top `limit` words by frequency, cached until the next mutation. */
  async snapshot(slideId: string, limit = 60): Promise<WordCloudSnapshot> {
    const bucket = await this.ensureHydrated(slideId);

    const cached = bucket.snapshotCache;
    if (cached && cached.version === bucket.version && cached.limit === limit) {
      return cached.snapshot;
    }

    const words = [...bucket.counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key, value]) => ({ text: bucket.display.get(key) ?? key, value }));

    const snapshot: WordCloudSnapshot = {
      words,
      totalWords: bucket.totalWords,
      uniqueWords: bucket.counts.size,
    };

    bucket.snapshotCache = { version: bucket.version, limit, snapshot };
    return snapshot;
  }


  async maybePersist(slideId: string, force = false): Promise<void> {
    const key = slideId.toString();
    const bucket = this.buckets.get(key);
    if (!bucket || !bucket.hydrated) return;
    if (bucket.version === bucket.lastPersistedVersion) return;

    const now = Date.now();
    if (!force && now - bucket.lastPersistAt < PERSIST_MIN_INTERVAL_MS) return;

    bucket.lastPersistAt = now;
    bucket.lastPersistedVersion = bucket.version;

    try {
      const { words } = await this.snapshot(slideId, 100);
      const options = words.map((word, index) => ({
        id: `word-${index}-${word.text}`,
        label: word.text,
        voteCount: word.value,
      }));
      await Slide.updateOne({ _id: slideId }, { $set: { options } });
    } catch (error: any) {
      // Allow a retry on the next tick.
      bucket.lastPersistedVersion = -1;
      console.error(`[WordCloudStore] Persist failed for slide ${slideId}:`, error.message);
    }
  }

  /** Forget a slide's counts (used when session data is wiped). */
  reset(slideId: string): void {
    this.buckets.delete(slideId.toString());
  }

  resetMany(slideIds: Array<string | mongoose.Types.ObjectId>): void {
    for (const id of slideIds) this.buckets.delete(id.toString());
  }
}

export const wordCloudStore = new WordCloudStore();
