import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RetryService } from './retry.service';
import { MonitoringModule } from 'src/monitoring/monitoring.module';

@Module({
  imports: [ConfigModule, MonitoringModule],
  providers: [LlmService, CircuitBreakerService, RetryService],
  exports: [LlmService, CircuitBreakerService, RetryService],
})
export class LlmModule {}
