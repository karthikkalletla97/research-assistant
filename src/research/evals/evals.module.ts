import { Module } from '@nestjs/common';
import { EvalsService } from './evals.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AgentModule],
  providers: [EvalsService],
  exports: [EvalsService],
})
export class EvalsModule {}
