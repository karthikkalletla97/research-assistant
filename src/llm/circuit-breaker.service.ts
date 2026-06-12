import { Injectable } from '@nestjs/common';
import { MonitoringService } from 'src/monitoring/monitoring.service';

enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, stop requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

@Injectable()
export class CircuitBreakerService {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  // Configuration
  private readonly failureThreshold = 5; // Open after 5 failures
  private readonly successThreshold = 2; // Close after 2 successes
  private readonly resetTimeout = 60 * 1000; // Try again after 60 seconds

  constructor(private monitoring: MonitoringService) {}
  /**
   * Check if request can proceed
   * Returns: true if should proceed, false if should fail fast
   */
  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true; // Normal operation
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to test recovery
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.resetTimeout) {
        console.log('Circuit breaker: Testing recovery (HALF_OPEN)');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true; // Try one request
      }
      return false; // Still open, fail fast
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true; // Testing, allow request
    }

    return false;
  }

  /**
   * Record success
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(
        `Circuit breaker: Success ${this.successCount}/${this.successThreshold}`,
      );

      if (this.successCount >= this.successThreshold) {
        console.log('Circuit breaker: recovered! Closing circuit');
        this.state = CircuitState.CLOSED;

        // RECORD RECOVERY
        this.monitoring.recordCircuitBreakerStateChange('CLOSED');

        this.successCount = 0;
      }
    }
  }

  /**
   * Record failure
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.log(
      `Circuit breaker: Failure ${this.failureCount}/${this.failureThreshold}`,
    );

    if (this.failureCount >= this.failureThreshold) {
      console.log('Circuit breaker: opening circuit');
      this.state = CircuitState.OPEN;

      // ALERT TEAM
      this.monitoring.recordCircuitBreakerStateChange('OPEN');

      this.failureCount = 0;
    }
  }

  /**
   * Get current state (for monitoring)
   */
  getState(): string {
    return this.state;
  }

  /**
   * Manually reset (for testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    console.log('Circuit breaker reset');
  }
}
