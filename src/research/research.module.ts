import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ResearchService } from './research/research.service';
import { ResearchController } from './research/research.controller';
import { ModelSelectorService } from './model-selector/model-selector.service';
import { HashBasedCacheService } from './cache/hash-based-cache.service';
import { SemanticCacheService } from './cache/semantic-cache.service';
import { CacheManagerService } from './cache/cache-manager.service';
import { CircuitBreakerService } from 'src/llm/circuit-breaker.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';
import { MonitoringModule } from 'src/monitoring/monitoring.module';

@Module({
  imports: [LlmModule, MonitoringModule],
  providers: [
    ResearchService,
    ModelSelectorService,
    HashBasedCacheService,
    SemanticCacheService,
    CacheManagerService,
    MonitoringService,
  ],
  controllers: [ResearchController],
})
export class ResearchModule {}
