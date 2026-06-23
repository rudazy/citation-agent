/**
 * Pure trust ranking and partition logic for the research agent.
 *
 * Network free and side effect free so it can be unit tested without touching
 * viem or the score API. Default behavior ranks but never blocks. A minimum
 * trust threshold is opt in: only when minTrust > 0 are low trust sources
 * skipped, and null (unscored) sources stay included unless strictUnscored is
 * also set.
 */

import type { TrustScore } from "./trustgate";

export type RankableSource<T> = {
  item: T;
  trust: TrustScore | null;
};

export type SkippedSource<T> = RankableSource<T> & { reason: string };

export type TrustPartition<T> = {
  cited: RankableSource<T>[];
  skipped: SkippedSource<T>[];
};

export type PartitionOptions = {
  /** Default 0 (no gate, everyone citeable). */
  minTrust?: number;
  /** When the gate is active, also skip null (unscored) sources. */
  strictUnscored?: boolean;
};

/** Null scores sort to the bottom of the cited list. */
function scoreValue(trust: TrustScore | null): number {
  return trust ? trust.score : Number.NEGATIVE_INFINITY;
}

export function partitionByTrust<T>(
  sources: RankableSource<T>[],
  options: PartitionOptions = {},
): TrustPartition<T> {
  const minTrust = options.minTrust ?? 0;
  const strictUnscored = options.strictUnscored ?? false;
  const gateActive = minTrust > 0;

  const cited: RankableSource<T>[] = [];
  const skipped: SkippedSource<T>[] = [];

  for (const source of sources) {
    if (!gateActive) {
      cited.push(source);
      continue;
    }

    if (source.trust === null) {
      if (strictUnscored) {
        skipped.push({ ...source, reason: "unscored (strict mode)" });
      } else {
        cited.push(source);
      }
      continue;
    }

    if (source.trust.score < minTrust) {
      skipped.push({ ...source, reason: "below trust threshold" });
    } else {
      cited.push(source);
    }
  }

  cited.sort((a, b) => scoreValue(b.trust) - scoreValue(a.trust));
  return { cited, skipped };
}
