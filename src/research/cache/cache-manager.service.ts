import { Injectable } from '@nestjs/common';
import { HashBasedCacheService } from './hash-based-cache.service';
import { SemanticCacheService } from './semantic-cache.service';

@Injectable()
export class CacheManagerService {
  constructor(
    private hashCache: HashBasedCacheService,
    private semanticCache: SemanticCacheService,
  ) {}

  /**
   * Get from cache (tries hash-based first, then semantic)
   */
  get(
    noteText: string,
    strategy: 'hash' | 'semantic' | 'both' = 'hash',
  ): unknown | null {
    if (strategy === 'hash' || strategy === 'both') {
      const hashResult = this.hashCache.get(noteText);
      if (hashResult) {
        console.log('Got result from hash cache');
        return hashResult;
      }
    }

    if (strategy === 'semantic' || strategy === 'both') {
      const semanticResult = this.semanticCache.get(noteText);
      if (semanticResult) {
        console.log('Got result from semantic cache');
        return semanticResult;
      }
    }

    console.log('No cache hit');
    return null;
  }

  /**
   * Store in cache
   */
  set(
    noteText: string,
    value: unknown,
    strategy: 'hash' | 'semantic' | 'both' = 'hash',
    ttlMinutes: number = 1440,
  ): void {
    if (strategy === 'hash' || strategy === 'both') {
      this.hashCache.set(noteText, value, ttlMinutes);
    }

    if (strategy === 'semantic' || strategy === 'both') {
      this.semanticCache.set(noteText, value, ttlMinutes);
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.hashCache.clear();
    this.semanticCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hash: ReturnType<typeof this.hashCache.getStats>;
    semantic: { size: number };
  } {
    return {
      hash: this.hashCache.getStats(),
      semantic: { size: this.semanticCache['cache']?.length || 0 },
    };
  }
}
