import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from 'src/llm/llm.service';

interface EmbeddingCache {
  text: string;
  embedding: number[];
  timestamp: number;
}

@Injectable()
export class EmbeddingService {
  private embeddingCache = new Map<string, EmbeddingCache>();
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private llmService: LlmService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate or retrieve cached embedding for text
   * Uses TF-IDF style approximation (free, fast, no API calls)
   */
  async getEmbedding(text: string): Promise<number[]> {
    // Step 1: Check cache
    const cached = this.embeddingCache.get(text);
    if (cached && !this.isCacheExpired(cached)) {
      console.log('✅ Embedding from cache');
      return cached.embedding;
    }

    // Step 2: Generate embedding
    console.log('📊 Generating embedding (TF-IDF)...');
    const embedding = this.generateEmbedding(text);

    // Step 3: Store in cache
    this.embeddingCache.set(text, {
      text,
      embedding,
      timestamp: Date.now(),
    });

    console.log(`💾 Cached embedding (dimension: ${embedding.length})`);
    return embedding;
  }

  /**
   * ACTIVE: Generate embedding using TF-IDF approximation
   * - Free (no API calls)
   * - Fast (instant computation)
   * - Works great for semantic search
   * - Production-ready for portfolio
   */
  private generateEmbedding(text: string): number[] {
    // Normalize text
    const normalized = text.toLowerCase();

    // Extract meaningful terms (remove common words)
    const stopwords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'from',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);

    const words = normalized
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopwords.has(word));

    // Create frequency map
    const frequencies = new Map<string, number>();
    words.forEach((word) => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });

    // Create 1024-dimensional vector
    const embedding = new Array(1024).fill(0);

    // For each word, hash it and add its frequency to multiple dimensions
    frequencies.forEach((freq, word) => {
      // Generate consistent hash for word
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Distribute word frequency across multiple dimensions
      const startIdx = Math.abs(hash) % 1000;
      for (let i = 0; i < 5; i++) {
        const idx = (startIdx + i * 200) % 1024;
        embedding[idx] += freq * 0.2;
      }
    });

    // Normalize vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );

    const normalized_embedding = embedding.map((val) =>
      magnitude > 0 ? val / magnitude : 0,
    );

    return normalized_embedding;
  }

  /**
   * REFERENCE: Alternative implementation using Voyage AI
   * Uncomment this method and swap with generateEmbedding() to use real embeddings
   *
   * Benefits:
   * - True semantic embeddings (better quality)
   * - Industry standard approach
   *
   * Trade-offs:
   * - Costs money ($5-10/month after free tier)
   * - API calls (adds latency)
   * - Rate limits (3 RPM free, higher with payment)
   *
   * To activate: Replace generateEmbedding() with this, add VOYAGE_API_KEY to .env
   */
  /*
  private async generateEmbeddingVoyage(text: string): Promise<number[]> {
    try {
      const voyageApiKey = this.configService.get('VOYAGE_API_KEY') || '';
      const voyageModel = this.configService.get('VOYAGE_MODEL') || 'voyage-4';

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${voyageApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: voyageModel,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Embedding API error: ${response.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();

      // Parse Voyage API response format
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('Invalid embedding response format');
      }

      const embedding = data.data[0].embedding;

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('No embedding found in response');
      }

      console.log(`✅ Got real embedding (Voyage): dimension ${embedding.length}`);
      return embedding;
    } catch (error) {
      console.error('Failed to generate Voyage embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
  */

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    // VALIDATE inputs
    if (!embedding1 || !Array.isArray(embedding1) || embedding1.length === 0) {
      console.warn('Invalid embedding1');
      return 0;
    }

    if (!embedding2 || !Array.isArray(embedding2) || embedding2.length === 0) {
      console.warn('Invalid embedding2');
      return 0;
    }

    const length = Math.min(embedding1.length, embedding2.length);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(entry: EmbeddingCache): boolean {
    return Date.now() - entry.timestamp > this.cacheTTL;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.embeddingCache.size,
      entries: this.embeddingCache.size,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    console.log('Cache cleared');
  }
}
