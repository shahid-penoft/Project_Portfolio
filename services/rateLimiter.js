/**
 * Token Bucket Rate Limiter
 *
 * Enforces smooth, deterministic rate limits for third-party API gateways (Brevo, Twilio, AWS SNS)
 * to eliminate HTTP 429 Too Many Requests and operator rate limiting.
 */

export class TokenBucketRateLimiter {
  /**
   * @param {number} requestsPerSecond - Max steady-state requests allowed per second (e.g. 5)
   * @param {number} maxBurst          - Max burst capacity (e.g. 8)
   */
  constructor(requestsPerSecond = 5, maxBurst = 8) {
    this.capacity = maxBurst;
    this.tokens = maxBurst;
    this.fillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Refills the bucket based on elapsed time.
   */
  refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.fillRate);
      this.lastRefill = now;
    }
  }

  /**
   * Asynchronously acquires 1 token. If no token is available,
   * sleeps for the required delay and retries.
   *
   * @returns {Promise<void>}
   */
  async acquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate time needed to replenish 1 token
    const missing = 1 - this.tokens;
    const waitMs = Math.ceil((missing / this.fillRate) * 1000);

    await new Promise((resolve) => setTimeout(resolve, Math.max(50, waitMs)));
    return this.acquire();
  }
}

// Global default Brevo SMS Rate Limiter instance: 5 requests / sec, max burst 8
export const brevoSmsLimiter = new TokenBucketRateLimiter(5, 8);
