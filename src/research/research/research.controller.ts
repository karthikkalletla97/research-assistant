import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ExtractFactsDto, ExtractedFacts } from '../dto/extract-facts.dto';
import { ResearchService } from './research.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';

@Controller('research')
export class ResearchController {
  constructor(
    private researchService: ResearchService,
    private monitoring: MonitoringService,
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

  @Post('extract-facts')
  @HttpCode(200)
  async extractFacts(@Body() dto: ExtractFactsDto): Promise<ExtractedFacts> {
    return this.researchService.extractFacts(dto.note);
  }
}
