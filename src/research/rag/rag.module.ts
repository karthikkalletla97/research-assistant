import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagService } from './rag.service';
import { Note } from 'src/database/entities/note.entity';
import { NoteChunk } from 'src/database/entities/note-chunk.entity';
import { SemanticSearchModule } from '../search/semantic-search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Note, NoteChunk]), SemanticSearchModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
