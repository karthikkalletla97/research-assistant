import { Injectable } from '@nestjs/common';

interface EmbeddingCacheEntry {
  noteText: string;
  embedding: number[];
  cachedResult: unknown;
  timestamp: number;
  ttlMinutes: number;
}

@Injectable()
export class SemanticCacheService {
  private cache: EmbeddingCacheEntry[] = [];
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.85; // Adjust this value

  /**
   * Generate a simple embedding from text
   * In production, you'd use Claude's embedding API
   * For now, we'll use a simplified approach
   */
  private generateEmbedding(text: string): number[] {
    // SIMPLIFIED: This is not a real embedding!
    // In production, use: const embedding = await claudeEmbeddingAPI.embed(text);

    // For demo: We'll use character frequency as a poor man's embedding
    const embedding = new Array(128).fill(0);

    const cleaned = text.toLowerCase();
    for (let i = 0; i < cleaned.length && i < 128; i++) {
      embedding[i] = cleaned.charCodeAt(i) / 256;
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns value between 0 and 1
   * 1.0 = identical, 0.0 = completely different
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Find similar cached entry
   * Returns cached result if similarity > threshold
   */
  get(
    noteText: string,
    threshold: number = this.DEFAULT_SIMILARITY_THRESHOLD,
  ): unknown | null {
    const currentEmbedding = this.generateEmbedding(noteText);

    for (const entry of this.cache) {
      // Check if expired
      const ageMinutes = (Date.now() - entry.timestamp) / (1000 * 60);
      if (ageMinutes > entry.ttlMinutes) {
        continue;
      }

      // Calculate similarity
      const similarity = this.cosineSimilarity(
        currentEmbedding,
        entry.embedding,
      );

      console.log('Similarity check:', {
        similarity: similarity.toFixed(3),
        threshold: threshold.toFixed(3),
        match: similarity >= threshold,
      });

      if (similarity >= threshold) {
        console.log('Semantic cache hit!');
        return entry.cachedResult;
      }
    }

    console.log('Semantic cache miss');
    return null;
  }

  /**
   * Store in semantic cache
   */
  set(noteText: string, value: unknown, ttlMinutes: number = 1440): void {
    const embedding = this.generateEmbedding(noteText);

    this.cache.push({
      noteText,
      embedding,
      cachedResult: value,
      timestamp: Date.now(),
      ttlMinutes,
    });

    console.log('Stored in semantic cache:', {
      textLength: noteText.length,
      embeddingDim: embedding.length,
      cacheSize: this.cache.length,
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache = [];
    console.log('Semantic cache cleared');
  }

  delete(key: string): void {
    const before = this.cache.length;
    this.cache = this.cache.filter((entry) => entry.noteText !== key);
    if (this.cache.length < before) {
      console.log(`🗑️  Deleted from semantic cache: ${key}`);
    }
  }

  /**
   * Set similarity threshold
   * Higher = more strict matching
   * 0.95 = very similar required
   * 0.80 = reasonably similar
   */
  setSimilarityThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
  }
}
