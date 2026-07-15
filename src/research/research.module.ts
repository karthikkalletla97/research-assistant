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
import { EmbeddingModule } from './embedding/embedding.module';
import { SemanticSearchModule } from './search/semantic-search.module';
import { AgentModule } from './agent/agent.module';
import { RagModule } from './rag/rag.module';
import { EvalsModule } from './evals/evals.module';

@Module({
  imports: [
    LlmModule,
    MonitoringModule,
    EmbeddingModule,
    SemanticSearchModule,
    AgentModule,
    RagModule,
    EvalsModule,
  ],
  providers: [
    ResearchService,
    ModelSelectorService,
    HashBasedCacheService,
    SemanticCacheService,
    CacheManagerService,
    MonitoringService,
  ],
  exports: [
    CacheManagerService,
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
