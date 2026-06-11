import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ResearchService } from './research/research.service';
import { ResearchController } from './research/research.controller';
import { ModelSelectorService } from './model-selector/model-selector.service';
import { HashBasedCacheService } from './cache/hash-based-cache.service';
import { SemanticCacheService } from './cache/semantic-cache.service';
import { CacheManagerService } from './cache/cache-manager.service';

@Module({
  imports: [LlmModule],
  providers: [
    ResearchService,
    ModelSelectorService,
    HashBasedCacheService,
    SemanticCacheService,
    CacheManagerService,
  ],
  controllers: [ResearchController],
})
export class ResearchModule {}
