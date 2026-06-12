import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module';
import { ResearchModule } from './research/research.module';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring/monitoring.service';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LlmModule,
    ResearchModule,
    MonitoringModule,
  ],
  providers: [],
})
export class AppModule {}
