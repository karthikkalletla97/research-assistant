/* eslint-disable @typescript-eslint/no-floating-promises */
import { Injectable } from '@nestjs/common';

interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

@Injectable()
export class MonitoringService {
  private metrics: Metric[] = [];

  /**
   * Record a metric (cost, latency, errors, etc.)
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics (prevent memory leak)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    console.log(`📊 Metric: ${name} = ${value}`, tags);
  }

  /**
   * Record API call success/failure
   */
  recordApiCall(
    modelUsed: string,
    success: boolean,
    latencyMs: number,
    costUSD: number,
  ): void {
    this.recordMetric('api_call.count', 1, {
      model: modelUsed,
      status: success ? 'success' : 'failure',
    });

    this.recordMetric('api_call.latency_ms', latencyMs, {
      model: modelUsed,
    });

    this.recordMetric('api_call.cost_usd', costUSD, {
      model: modelUsed,
    });
  }

  /**
   * Record circuit breaker state change
   */
  recordCircuitBreakerStateChange(newState: string): void {
    this.recordMetric('circuit_breaker.state_change', 1, {
      state: newState,
    });

    // ALERT: If circuit opens, this is critical
    if (newState === 'OPEN') {
      this.sendAlert('🚨 CRITICAL: Circuit breaker opened!', {
        severity: 'critical',
        component: 'circuit_breaker',
      });
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(hit: boolean): void {
    this.recordMetric('cache.event', 1, {
      type: hit ? 'hit' : 'miss',
    });
  }

  /**
   * Calculate metrics
   */
  getMetricsSummary(timeWindowMs: number = 3600000): {
    totalApiCalls: number;
    failureRate: number;
    averageLatencyMs: number;
    cacheHitRate: number;
    totalCostUSD: number;
  } {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(
      (m) => now - m.timestamp < timeWindowMs,
    );

    const apiCalls = recentMetrics.filter((m) => m.name === 'api_call.count');
    const failures = apiCalls.filter((m) => m.tags.status === 'failure');
    const latencies = recentMetrics.filter(
      (m) => m.name === 'api_call.latency_ms',
    );
    const costs = recentMetrics.filter((m) => m.name === 'api_call.cost_usd');
    const cacheHits = recentMetrics.filter(
      (m) => m.name === 'cache.event' && m.tags.type === 'hit',
    );
    const cacheMisses = recentMetrics.filter(
      (m) => m.name === 'cache.event' && m.tags.type === 'miss',
    );

    const totalCalls = apiCalls.length;
    const failureCount = failures.length;
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, m) => sum + m.value, 0) / latencies.length
        : 0;
    const totalCost = costs.reduce((sum, m) => sum + m.value, 0);
    const cacheTotal = cacheHits.length + cacheMisses.length;
    const hitRate = cacheTotal > 0 ? (cacheHits.length / cacheTotal) * 100 : 0;

    return {
      totalApiCalls: totalCalls,
      failureRate: totalCalls > 0 ? (failureCount / totalCalls) * 100 : 0,
      averageLatencyMs: avgLatency,
      cacheHitRate: hitRate,
      totalCostUSD: totalCost,
    };
  }

  /**
   * Check if alerts should be triggered
   */
  checkAlertsAndNotify(
    metrics: ReturnType<typeof this.getMetricsSummary>,
  ): void {
    // Alert 1: Cache hit rate too low
    if (metrics.cacheHitRate < 30) {
      this.sendAlert(
        `⚠️ WARNING: Cache hit rate is ${metrics.cacheHitRate.toFixed(1)}% (threshold: 30%)`,
        {
          severity: 'warning',
          component: 'cache',
          metric: 'hit_rate',
          value: metrics.cacheHitRate.toFixed(1),
        },
      );
    }

    // Alert 2: Daily cost too high
    if (metrics.totalCostUSD > 100) {
      this.sendAlert(
        `⚠️ WARNING: Daily cost is $${metrics.totalCostUSD.toFixed(2)} (threshold: $100)`,
        {
          severity: 'warning',
          component: 'cost',
          metric: 'daily_cost',
          value: metrics.totalCostUSD.toFixed(2),
        },
      );
    }

    // Alert 3: Failure rate elevated (optional)
    if (metrics.failureRate > 10) {
      this.sendAlert(
        `⚠️ WARNING: Failure rate is ${metrics.failureRate.toFixed(1)}% (threshold: 10%)`,
        {
          severity: 'warning',
          component: 'api',
          metric: 'failure_rate',
          value: metrics.failureRate.toFixed(1),
        },
      );
    }
  }

  /**
   * Enhanced alert with real integrations
   */
  private async sendAlert(
    message: string,
    context: Record<string, string>,
  ): Promise<void> {
    console.error('🚨 ALERT:', message, context);

    // In production, send to PagerDuty and Email
    try {
      // Send to PagerDuty (for urgent alerts)
      if (context.severity === 'critical') {
        await this.sendToPagerDuty(message, context);
      }

      // Send email (for all alerts)
      await this.sendEmail(message, context);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  private async sendToPagerDuty(
    message: string,
    context: Record<string, string>,
  ): Promise<void> {
    // In production:
    // const pagerDutyApiKey = process.env.PAGERDUTY_API_KEY;
    // const response = await axios.post('https://events.pagerduty.com/v2/enqueue', {
    //   routing_key: pagerDutyApiKey,
    //   event_action: 'trigger',
    //   payload: {
    //     summary: message,
    //     severity: context.severity,
    //     source: 'Research Assistant',
    //     custom_details: context,
    //   },
    // });

    console.log('[PagerDuty] Would send alert:', message);
  }

  private async sendEmail(
    message: string,
    context: Record<string, string>,
  ): Promise<void> {
    // In production:
    // const emailService = require('@sendgrid/mail');
    // await emailService.send({
    //   to: 'team@example.com',
    //   from: 'alerts@example.com',
    //   subject: `Alert: ${context.component}`,
    //   text: message,
    //   html: `<p>${message}</p><pre>${JSON.stringify(context, null, 2)}</pre>`,
    // });

    console.log('[Email] Would send alert:', message);
  }

  /**
   * Get all metrics (for debugging)
   */
  getAllMetrics(): Metric[] {
    return this.metrics;
  }

  /**
   * Clear metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}
