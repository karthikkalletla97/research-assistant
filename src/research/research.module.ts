import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ResearchService } from './research/research.service';
import { ResearchController } from './research/research.controller';


@Module({
  imports: [LlmModule],
  providers: [ResearchService],
  controllers: [ResearchController],
})
export class ResearchModule {}