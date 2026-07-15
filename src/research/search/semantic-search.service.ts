import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoteChunk } from '../../database/entities/note-chunk.entity';

@Injectable()
export class SemanticSearchService {
  constructor(
    @InjectRepository(NoteChunk) private chunkRepository: Repository<NoteChunk>,
  ) {}

  /**
   * Hybrid search: PostgreSQL tsvector + token overlap
   */
  async search(
    query: string,
    topK: number = 100,
    threshold: number = 0,
  ): Promise<any[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      console.log(`🔍 Searching for: "${query}"`);

      // SEARCH 1: PostgreSQL full-text search (keyword)
      const tsvectorResults = await this.chunkRepository
        .createQueryBuilder('nc')
        .select('nc.noteId', 'noteId')
        .addSelect('nc.text', 'text')
        .addSelect(
          `ts_rank(nc.search_vector, websearch_to_tsquery('english', :query))`,
          'similarity',
        )
        .where(`nc.search_vector @@ websearch_to_tsquery('english', :query)`, {
          query,
        })
        .getRawMany();

      console.log(`  ✅ PostgreSQL found ${tsvectorResults.length} results`);

      // SEARCH 2: Token overlap semantic search (in-memory)
      const allChunks = await this.chunkRepository.find();
      const queryTokens = this.tokenize(query);
      const querySet = new Set(queryTokens);

      const tokenResults = allChunks
        .map((chunk) => {
          const chunkTokens = this.tokenize(chunk.text);
          const chunkSet = new Set(chunkTokens);

          const intersection = new Set(
            [...querySet].filter((x) => chunkSet.has(x)),
          );
          const union = new Set([...querySet, ...chunkSet]);

          const jaccardScore =
            union.size > 0 ? intersection.size / union.size : 0;

          return {
            noteId: chunk.noteId,
            text: chunk.text.substring(0, 50),
            similarity: jaccardScore,
          };
        })
        .filter((r) => r.similarity > 0);

      console.log(`  ✅ Token overlap found ${tokenResults.length} results`);

      // COMBINE: Merge both results (60% tsvector + 40% token overlap)
      const combined = new Map();

      // Add tsvector results
      tsvectorResults.forEach((r: any) => {
        const key = r.noteId;
        combined.set(key, {
          noteId: r.noteId,
          text: r.text,
          tsvectorScore: parseFloat(r.similarity) || 0.1,
          tokenScore: 0,
        });
      });

      // Add/merge token results
      tokenResults.forEach((r: any) => {
        const key = r.noteId;
        if (combined.has(key)) {
          combined.get(key).tokenScore = r.similarity;
        } else {
          combined.set(key, {
            noteId: r.noteId,
            text: r.text,
            tsvectorScore: 0,
            tokenScore: r.similarity,
          });
        }
      });

      // Calculate final score: 60% tsvector + 40% token
      const finalResults = Array.from(combined.values())
        .map((r: any) => ({
          noteId: r.noteId,
          text: r.text,
          similarity: 0.6 * (r.tsvectorScore || 0) + 0.4 * r.tokenScore,
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      console.log(`  ✅ Hybrid merged: ${finalResults.length} results`);
      return finalResults;
    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  }

  /**
   * Add note (no-op - trigger handles tsvector)
   */
  addNote(text: string, facts: any, dbNoteId: number): void {
    console.log(`✅ Note indexed via PostgreSQL tsvector trigger`);
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2);
  }

  /**
   * Get stats
   */
  getStats(): any {
    return {
      searchType: 'Hybrid (PostgreSQL tsvector 60% + token overlap 40%)',
    };
  }
}
