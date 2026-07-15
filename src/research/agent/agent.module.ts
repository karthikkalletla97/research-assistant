import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LlmModule } from 'src/llm/llm.module';
import { SemanticSearchModule } from '../search/semantic-search.module';
import { RagModule } from '../rag/rag.module';
import { ResearchModule } from '../research.module';
import { CacheManagerService } from '../cache/cache-manager.service';
import { HashBasedCacheService } from '../cache/hash-based-cache.service';
import { SemanticCacheService } from '../cache/semantic-cache.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';

@Module({
  imports: [SemanticSearchModule, LlmModule, RagModule],
  providers: [
    AgentService,
    CacheManagerService,
    HashBasedCacheService,
    SemanticCacheService,
    MonitoringService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
