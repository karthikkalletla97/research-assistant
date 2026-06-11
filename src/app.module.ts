import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module';
import { ResearchModule } from './research/research.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LlmModule,
    ResearchModule,
  ],
  providers: [],
})
export class AppModule {}
