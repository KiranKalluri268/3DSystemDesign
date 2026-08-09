/**
 * Latency samples and the percentiles read off them.
 *
 * p99 is the number the game is really about — a design can have a healthy
 * mean and still be broken for one request in a hundred, and that is exactly
 * the lesson levels are built around. So percentiles are computed exactly
 * from retained samples rather than estimated from bucket counts.
 */
export class LatencyHistogram {
  private samples: number[] = [];
  private sorted = true;

  record(latencyMs: number): void {
    this.samples.push(latencyMs);
    this.sorted = false;
  }

  get count(): number {
    return this.samples.length;
  }

  /**
   * Nearest-rank percentile. `p` is a fraction in [0, 1]; returns 0 for an
   * empty histogram, since "no requests completed" is a score of zero latency
   * only in the sense that the error rate will already have failed the level.
   */
  percentile(p: number): number {
    if (this.samples.length === 0) return 0;
    if (!this.sorted) {
      this.samples.sort((a, b) => a - b);
      this.sorted = true;
    }
    const rank = Math.ceil(p * this.samples.length);
    const index = Math.min(Math.max(rank - 1, 0), this.samples.length - 1);
    return this.samples[index]!;
  }

  mean(): number {
    if (this.samples.length === 0) return 0;
    let total = 0;
    for (const s of this.samples) total += s;
    return total / this.samples.length;
  }
}
