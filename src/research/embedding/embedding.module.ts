import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { LlmModule } from 'src/llm/llm.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [LlmModule, ConfigModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
