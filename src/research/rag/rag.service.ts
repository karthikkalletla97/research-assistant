import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from 'src/database/entities/note.entity';
import { NoteChunk } from 'src/database/entities/note-chunk.entity';
import { SemanticSearchService } from '../search/semantic-search.service';

interface RetrievedChunk {
  noteId: number;
  chunkIndex: number;
  text: string;
  similarity: number;
  source: string;
}

@Injectable()
export class RagService {
  private readonly CHUNK_SIZE_TOKENS = 500;
  private readonly CHUNK_OVERLAP_TOKENS = 50;

  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,

    @InjectRepository(NoteChunk)
    private readonly chunkRepository: Repository<NoteChunk>,

    private readonly semanticSearchService: SemanticSearchService,
  ) {
    this.initializeSemanticSearch();
    console.log('✅ RagService initialized');
  }

  private async initializeSemanticSearch() {
    console.log('🔄 Initializing semantic search index...');
    try {
      const allChunks = await this.chunkRepository.find({
        relations: { note: true },
      });

      // Group by note_id to track unique notes
      const noteIds = new Set<number>();
      for (const note of allChunks) {
        noteIds.add(note.note.id);
      }

      for (const chunk of allChunks) {
        if (chunk.text && chunk.text.trim().length > 0) {
          const facts: any = {
            summary: chunk.text.substring(0, 200),
            full_text: chunk.text,
          };

          // Add to semantic search with note ID
          this.semanticSearchService.addNote(
            chunk.text,
            facts,
            chunk.note.id, // Use note relationship
          );

          noteIds.add(chunk.note.id);
        }
      }

      console.log(
        `✅ Loaded ${noteIds.size} notes (${allChunks.length} chunks) into semantic search`,
      );
    } catch (error) {
      console.error('❌ Failed to initialize semantic search:', error);
    }
  }
  /**
   * Store a note and create chunks for RAG
   */
  async storeNote(
    text: string,
    userId: string = 'default_user',
    metadata?: Record<string, any>,
  ): Promise<Note> {
    console.log('💾 Storing note with RAG chunking...');

    try {
      // Step 1: Create and save note
      const note = this.noteRepository.create({
        text,
        userId,
        metadata: metadata || {},
      });

      const savedNote = await this.noteRepository.save(note);
      console.log(`✅ Note saved (ID: ${savedNote.id})`);

      // Step 2: Create chunks
      const chunks = this.chunkText(text, savedNote.id);
      console.log(`📦 Created ${chunks.length} chunks`);

      // Step 3: Save chunks
      await this.chunkRepository.save(chunks);
      console.log(`✅ Chunks saved to database`);

      // Step 4: Return note with chunks
      // FIX: Use object syntax for relations, handle null
      const noteWithChunks = await this.noteRepository.findOne({
        where: { id: savedNote.id },
        relations: { chunks: true }, // FIX: Object syntax instead of array
      });

      if (!noteWithChunks) {
        throw new Error(`Note ${savedNote.id} not found`);
      }

      return noteWithChunks;
    } catch (error) {
      console.error('❌ Error storing note:', error);
      throw error;
    }
  }

  /**
   * Chunk text into 500-token pieces with overlap
   */
  private chunkText(text: string, noteId: number): NoteChunk[] {
    const words = text.split(/\s+/);
    const chunks: NoteChunk[] = [];
    let chunkIndex = 0;
    let currentChunk: string[] = [];

    for (let i = 0; i < words.length; i++) {
      currentChunk.push(words[i]);

      const estimatedTokens = currentChunk.join(' ').length / 4;

      if (estimatedTokens >= this.CHUNK_SIZE_TOKENS) {
        const chunkText = currentChunk.join(' ');

        const chunk = this.chunkRepository.create({
          noteId,
          chunkIndex,
          text: chunkText,
          tokenCount: Math.ceil(estimatedTokens),
        });

        chunks.push(chunk);

        const overlapWords = Math.floor((this.CHUNK_OVERLAP_TOKENS * 4) / 5);
        currentChunk = currentChunk.slice(-overlapWords);
        chunkIndex++;
      }
    }

    // Save final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      const chunk = this.chunkRepository.create({
        noteId,
        chunkIndex,
        text: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
      });
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Retrieve relevant chunks for a query
   */
  async retrieveChunks(
    query: string,
    topK: number = 5,
  ): Promise<RetrievedChunk[]> {
    console.log(`\n📚 RAG Retrieval: "${query}"`);

    try {
      const searchResults = await this.semanticSearchService.search(
        query,
        topK,
        0.01,
      );

      if (searchResults.length === 0) {
        console.log('⚠️  No relevant chunks found');
        return [];
      }

      const retrievedChunks: RetrievedChunk[] = [];

      for (const result of searchResults) {
        const chunks = await this.chunkRepository.find({
          where: { noteId: result.noteId },
          order: { chunkIndex: 'ASC' },
          take: 1,
        });

        if (chunks.length > 0) {
          const chunk = chunks[0];
          retrievedChunks.push({
            noteId: chunk.noteId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            similarity: result.similarity,
            source: `Note ${chunk.noteId}, Chunk ${chunk.chunkIndex}`,
          });
        }
      }

      const topChunks = retrievedChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      console.log(`✅ Retrieved ${topChunks.length} chunks for RAG`);
      return topChunks;
    } catch (error) {
      console.error('❌ Error retrieving chunks:', error);
      throw error;
    }
  }

  /**
   * Build context string from chunks
   */
  buildContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context found.';
    }

    const context = chunks
      .map((chunk) => `[Source: ${chunk.source}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    return `Here is the relevant context from your notes:\n\n${context}`;
  }

  /**
   * Get stats
   */
  async getStats(): Promise<{
    totalNotes: number;
    totalChunks: number;
  }> {
    try {
      const totalNotes = await this.noteRepository.count();
      const totalChunks = await this.chunkRepository.count();
      return { totalNotes, totalChunks };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }
}
