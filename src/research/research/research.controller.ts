import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ExtractFactsDto, ExtractedFacts } from '../dto/extract-facts.dto';
import { ResearchService } from './research.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';
import { SemanticSearchService } from '../search/semantic-search.service';
import { AgentService } from '../agent/agent.service';
import { RagService } from '../rag/rag.service';
import { EvalResult, EvalsService } from '../evals/evals.service';

@Controller('research')
export class ResearchController {
  constructor(
    private researchService: ResearchService,
    private monitoring: MonitoringService,
    private semanticSearchService: SemanticSearchService,
    private agentService: AgentService,
    private ragService: RagService,
    private evalsService: EvalsService,
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.monitoring.getMetricsSummary(3600000); // Last 1 hour
  }

  @Get('health')
  getHealth() {
    const metrics = this.monitoring.getMetricsSummary(3600000);
    this.monitoring.checkAlertsAndNotify(metrics);

    return {
      status: metrics.failureRate < 10 ? 'healthy' : 'degraded',
      failureRate: metrics.failureRate.toFixed(2) + '%',
      cacheHitRate: metrics.cacheHitRate.toFixed(2) + '%',
      averageLatencyMs: metrics.averageLatencyMs.toFixed(0),
      totalCostUSD: metrics.totalCostUSD.toFixed(2),
    };
  }

  // @Post('extract-facts')
  // @HttpCode(200)
  // async extractFacts(@Body() dto: ExtractFactsDto): Promise<ExtractedFacts> {
  //   return this.researchService.extractFacts(dto.note);
  // }

  /**
   * POST /research/extract-facts
   * Extract facts AND store in RAG (controller just orchestrates)
   */
  @Post('extract-facts')
  async extractFacts(@Body('text') text: string) {
    if (!text) {
      throw new BadRequestException('Text is required');
    }

    // Call service (service handles all logic)
    const result = await this.researchService.extractFactsAndStore(text);

    return {
      success: true,
      noteId: result.noteId,
      extracted: result.facts,
      rag_status: `Stored with ${result.chunkCount} chunks`,
    };
  }

  /**
   * POST /research/rag/retrieve
   * Retrieve chunks (for testing/debugging)
   */
  @Post('rag/retrieve')
  async retrieveChunks(@Body('query') query: string) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }

    const chunks = await this.ragService.retrieveChunks(query, 5);

    return {
      query,
      chunkCount: chunks.length,
      chunks: chunks.map((c) => ({
        source: c.source,
        similarity: (c.similarity * 100).toFixed(1) + '%',
        text: c.text.substring(0, 100) + '...',
      })),
    };
  }

  /**
   * GET /research/rag/stats
   * Get RAG statistics
   */
  @Get('rag/stats')
  async getRagStats() {
    return this.ragService.getStats();
  }

  /**
   * POST /research/search
   * Search for similar notes by semantic meaning
   */
  @Post('search')
  async searchNotes(
    @Body('query') query: string,
    @Body('topK') topK: number = 5,
  ) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }

    const results = await this.semanticSearchService.search(query, topK);

    return {
      query,
      resultCount: results.length,
      results: results.map((r) => ({
        rank: r.rank,
        similarity: (r.similarity * 100).toFixed(1) + '%',
        noteText: r.noteText.substring(0, 100) + '...',
        facts: r.extractedFacts,
      })),
    };
  }

  /**
   * GET /research/search/stats
   * Get search database stats
   */
  @Get('search/stats')
  getSearchStats() {
    return this.semanticSearchService.getStats();
  }

  /**
   * POST /research/analyze
   * Agent endpoint: Multi-step analysis with orchestration
   *
   * Takes user query, autonomously:
   * 1. Parses intent
   * 2. Searches relevant notes
   * 3. Extracts facts
   * 4. Synthesizes findings
   * 5. Generates recommendations
   */
  @Post('analyze')
  async analyzeWithAgent(@Body('query') query: string) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }

    console.log(`\n📡 CRM Agent Analysis Request: "${query}"`);

    const analysis = await this.agentService.analyze(query);

    return {
      success: true,
      query,
      response: analysis.response,
      metadata: {
        fromCache: analysis.metadata?.fromCache,
        isComplexQuery: analysis.isComplexQuery,
        contextMetrics: {
          candidatesRetrieved: analysis.metadata?.candidatesRetrieved,
          chunksSelected: analysis.metadata?.chunksSelected,
          contextTokens: analysis.metadata?.contextTokens,
          utilization: analysis.metadata?.contextUtilization,
          latencyMs: analysis.metadata?.latencyMs,
        },
        estimatedCost: analysis.estimatedCost,
      },
    };
  }

  @Post('/evals/run')
  async runEvals(): Promise<{
    summary: any;
    resultsCount: number;
    results: EvalResult[];
  }> {
    const { results, summary } = await this.evalsService.runAllEvals();
    return { summary, resultsCount: results.length, results };
  }

  @Get('/evals/report')
  async getEvalsReport(): Promise<{ html: string }> {
    const { results, summary } = await this.evalsService.runAllEvals();
    const html = this.evalsService.generateReport(results, summary);
    return { html };
  }
}
