import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import * as fs from 'fs';
import * as path from 'path';

interface TestQuery {
  id: number;
  query: string;
  expectedKeywords: string[];
  expectedMinCandidates: number;
  complexity: 'simple' | 'complex';
}

export interface EvalResult {
  queryId: number;
  query: string;
  passed: boolean;
  score: number;
  metrics: {
    hasExpectedKeywords: boolean;
    candidatesRetrieved: number;
    latencyMs: number;
    cost: string;
  };
  details: string;
}

@Injectable()
export class EvalsService {
  private testQueries: TestQuery[] = [];

  constructor(private agentService: AgentService) {
    this.loadTestQueries();
  }

  /**
   * Load test queries from JSON file
   */
  private loadTestQueries(): void {
    this.testQueries = [
      {
        id: 1,
        query: 'Who is John?',
        expectedKeywords: ['john', 'enterprise', 'customer'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 2,
        query: "What is John's budget?",
        expectedKeywords: ['john', 'budget', '50k'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 3,
        query: 'Who is Jane?',
        expectedKeywords: ['jane', 'discovery'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 4,
        query: 'Why should we prioritize John over Jane?',
        expectedKeywords: ['john', 'jane', 'budget'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 5,
        query: "What's John's status?",
        expectedKeywords: ['john', 'enterprise'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 6,
        query: 'List all customers with confirmed budgets',
        expectedKeywords: ['john', 'confirmed'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 7,
        query: 'Compare John and Jane',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 8,
        query: 'When did we meet with John?',
        expectedKeywords: ['john', 'june'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 9,
        query: "What's Jane's next step?",
        expectedKeywords: ['jane', 'discovery'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 10,
        query: 'Who has executive sponsorship?',
        expectedKeywords: ['john'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 11,
        query: 'Which customer is closest to closing?',
        expectedKeywords: ['john', 'weeks'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 12,
        query: 'Who is still in discovery?',
        expectedKeywords: ['jane'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 13,
        query: 'What are the pain points for John?',
        expectedKeywords: ['john', 'vendor'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 14,
        query: 'Who was met with on June 15?',
        expectedKeywords: ['john', 'june', '15'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 15,
        query: 'Which customer has the highest budget?',
        expectedKeywords: ['john', '50k'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 16,
        query: 'How many contacts do we have for Jane?',
        expectedKeywords: ['jane', 'contact'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 17,
        query: "What's the timeline for John's decision?",
        expectedKeywords: ['john', 'weeks', 'decision'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 18,
        query: 'Is there budget confirmed for Jane?',
        expectedKeywords: ['jane', 'budget'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 19,
        query: 'Who should we follow up with first?',
        expectedKeywords: ['john'],
        expectedMinCandidates: 1,
        complexity: 'complex',
      },
      {
        id: 20,
        query: "What's the difference between John and Jane?",
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 21,
        query: 'John enterprise status',
        expectedKeywords: ['john', 'enterprise'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 22,
        query: 'Jane discovery phase details',
        expectedKeywords: ['jane', 'discovery'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 23,
        query: 'Customers with confirmed vs unconfirmed budgets',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 24,
        query: 'Who introduced John to us?',
        expectedKeywords: ['john', 'partner'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 25,
        query: "Jane's monthly check-in status",
        expectedKeywords: ['jane', 'monthly'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 26,
        query: 'Who has more decision makers?',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 27,
        query: "John's CFO and VP information",
        expectedKeywords: ['john', 'cfo', 'vp'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 28,
        query: "Jane's executive sponsorship status",
        expectedKeywords: ['jane', 'sponsorship'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 29,
        query: 'Which customer is more responsive?',
        expectedKeywords: ['john', 'jane', 'response'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 30,
        query: "John's current vendor pain point",
        expectedKeywords: ['john', 'vendor', 'pain'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 31,
        query: 'Jane needs to learn more',
        expectedKeywords: ['jane', 'learning'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 32,
        query: "When is John's decision expected?",
        expectedKeywords: ['john', 'weeks'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 33,
        query: 'First call date with Jane',
        expectedKeywords: ['jane', 'june', '1st'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 34,
        query: 'Priority ranking John vs Jane',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 35,
        query: 'John warm introduction source',
        expectedKeywords: ['john', 'warm', 'partner'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 36,
        query: "Jane's single point of contact",
        expectedKeywords: ['jane', 'contact'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 37,
        query: 'Customers ready to close',
        expectedKeywords: ['john'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 38,
        query: 'Customers still learning',
        expectedKeywords: ['jane'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 39,
        query: 'Budget comparison all customers',
        expectedKeywords: ['john', '50k'],
        expectedMinCandidates: 1,
        complexity: 'complex',
      },
      {
        id: 40,
        query: "John's meeting participants",
        expectedKeywords: ['john', 'vp', 'cfo'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 41,
        query: "Jane's engagement level",
        expectedKeywords: ['jane', 'interested'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 42,
        query: 'Fastest sales cycle customer',
        expectedKeywords: ['john'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 43,
        query: 'Slowest sales cycle customer',
        expectedKeywords: ['jane'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 44,
        query: 'Who can close this month?',
        expectedKeywords: ['john'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 45,
        query: 'Who needs more nurturing?',
        expectedKeywords: ['jane'],
        expectedMinCandidates: 1,
        complexity: 'simple',
      },
      {
        id: 46,
        query: 'Customer response time comparison',
        expectedKeywords: ['john', 'jane', 'responsive'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 47,
        query: "John's deal probability",
        expectedKeywords: ['john', 'confirmed', 'responsive'],
        expectedMinCandidates: 1,
        complexity: 'complex',
      },
      {
        id: 48,
        query: "Jane's deal probability",
        expectedKeywords: ['jane', 'discovery'],
        expectedMinCandidates: 1,
        complexity: 'complex',
      },
      {
        id: 49,
        query: 'Next steps for both customers',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
      {
        id: 50,
        query: 'Full customer pipeline status',
        expectedKeywords: ['john', 'jane'],
        expectedMinCandidates: 2,
        complexity: 'complex',
      },
    ];
    console.log(`📋 Loaded ${this.testQueries.length} test queries`);
  }

  /**
   * Run all evals
   */
  async runAllEvals(): Promise<{ results: EvalResult[]; summary: any }> {
    console.log(
      `\n🧪 Running evals on ${this.testQueries.length} queries...\n`,
    );

    const results: EvalResult[] = [];
    const startTime = Date.now();

    for (const testQuery of this.testQueries) {
      const result = await this.evalQuery(testQuery);
      results.push(result);

      // Log progress
      const status = result.passed ? '✅' : '❌';
      console.log(
        `${status} Query ${result.queryId}: "${result.query.substring(0, 40)}..." (${result.score.toFixed(2)})`,
      );
    }

    const duration = Date.now() - startTime;

    // Calculate summary
    const summary = this.calculateSummary(results, duration);

    return { results, summary };
  }

  /**
   * Evaluate a single query
   */
  private async evalQuery(testQuery: TestQuery): Promise<EvalResult> {
    try {
      const response = await this.agentService.analyze(testQuery.query);

      // Check criteria
      const responseText = response.response.toLowerCase();
      const hasExpectedKeywords = testQuery.expectedKeywords.some((kw) =>
        responseText.includes(kw.toLowerCase()),
      );

      const candidatesRetrieved = response.metadata?.candidatesRetrieved ?? 0;
      const meetsMinCandidates =
        candidatesRetrieved >= testQuery.expectedMinCandidates;

      // Score: 0-1
      // 60% keywords, 40% candidates
      const keywordScore = hasExpectedKeywords ? 0.6 : 0;
      const candidateScore = meetsMinCandidates
        ? 0.4
        : candidatesRetrieved > 0
          ? 0.2
          : 0;
      const score = keywordScore + candidateScore;

      const passed = score >= 0.8; // Pass if score >= 80%

      return {
        queryId: testQuery.id,
        query: testQuery.query,
        passed,
        score,
        metrics: {
          hasExpectedKeywords,
          candidatesRetrieved,
          latencyMs: response.metadata?.latencyMs ?? 0,
          cost: response.estimatedCost,
        },
        details: `Keywords: ${hasExpectedKeywords ? '✓' : '✗'}, Candidates: ${candidatesRetrieved}/${testQuery.expectedMinCandidates}`,
      };
    } catch (error) {
      return {
        queryId: testQuery.id,
        query: testQuery.query,
        passed: false,
        score: 0,
        metrics: {
          hasExpectedKeywords: false,
          candidatesRetrieved: 0,
          latencyMs: 0,
          cost: '$0',
        },
        details: `Error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: EvalResult[], duration: number): any {
    const passCount = results.filter((r) => r.passed).length;
    const avgScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const avgLatency =
      results.reduce((sum, r) => sum + r.metrics.latencyMs, 0) / results.length;
    const totalCost = results.length * 0.003; // Rough estimate

    return {
      totalQueries: results.length,
      passed: passCount,
      failed: results.length - passCount,
      accuracy: `${((passCount / results.length) * 100).toFixed(1)}%`,
      avgScore: avgScore.toFixed(2),
      avgLatency: `${avgLatency.toFixed(0)}ms`,
      totalCost: `$${totalCost.toFixed(4)}`,
      duration: `${(duration / 1000).toFixed(1)}s`,
    };
  }

  /**
   * Generate HTML report
   */
  generateReport(results: EvalResult[], summary: any): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ContextAgent Evals Report</title>
  <style>
    body { font-family: Arial; margin: 20px; background: #f5f5f5; }
    .header { background: #333; color: white; padding: 20px; border-radius: 5px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .metric { background: white; padding: 15px; border-radius: 5px; text-align: center; }
    .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
    .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
    th { background: #007bff; color: white; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .passed { color: green; font-weight: bold; }
    .failed { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ContextAgent Evals Report</h1>
    <p>System performance evaluation on ${summary.totalQueries} test queries</p>
  </div>

  <div class="summary">
    <div class="metric">
      <div class="metric-value">${summary.accuracy}</div>
      <div class="metric-label">Accuracy</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.avgLatency}</div>
      <div class="metric-label">Avg Latency</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.totalCost}</div>
      <div class="metric-label">Total Cost</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.duration}</div>
      <div class="metric-label">Duration</div>
    </div>
  </div>

  <h2>Results</h2>
  <table>
    <tr>
      <th>Query ID</th>
      <th>Query</th>
      <th>Status</th>
      <th>Score</th>
      <th>Candidates</th>
      <th>Latency</th>
      <th>Details</th>
    </tr>
    ${results
      .map(
        (r) => `
      <tr>
        <td>#${r.queryId}</td>
        <td>${r.query.substring(0, 50)}</td>
        <td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? '✓ PASS' : '✗ FAIL'}</td>
        <td>${(r.score * 100).toFixed(0)}%</td>
        <td>${r.metrics.candidatesRetrieved}</td>
        <td>${r.metrics.latencyMs}ms</td>
        <td>${r.details}</td>
      </tr>
    `,
      )
      .join('')}
  </table>
</body>
</html>
    `;
    return html;
  }
}
