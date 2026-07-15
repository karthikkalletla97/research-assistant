import { Module } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { NoteChunk } from 'src/database/entities/note-chunk.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [EmbeddingModule, TypeOrmModule.forFeature([NoteChunk])],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],
})
export class SemanticSearchModule {}
