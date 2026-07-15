import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as crypto from 'crypto'; // ADD THIS LINE

// Make crypto available globally
if (!globalThis.crypto) {
  globalThis.crypto = crypto as any;
}

import { ResearchModule } from './research/research.module';
import { LlmModule } from './llm/llm.module';

// Entities
import { Note } from './database/entities/note.entity';
import { NoteChunk } from './database/entities/note-chunk.entity';

@Module({
  imports: [
    // 1. ConfigModule FIRST
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. TypeORM SECOND (before any modules that use it)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'research_assistant'),
        entities: [Note, NoteChunk],
        synchronize: true,
        logging: false,
      }),
    }),

    // 3. Feature modules LAST
    LlmModule,
    ResearchModule,
  ],
})
export class AppModule {}
