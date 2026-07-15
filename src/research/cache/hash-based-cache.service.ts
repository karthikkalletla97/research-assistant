import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface CacheEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttlMinutes: number;
}

@Injectable()
export class HashBasedCacheService {
  private cache = new Map<string, CacheEntry>();

  /**
   * Convert seconds to minutes for TTL
   * (just for cleaner test code)
   */
  private secondsToMinutes(seconds: number): number {
    return seconds / 60;
  }

  /**
   * Extract important parts of note (remove dates, timestamps, etc.)
   * so that similar notes with different dates get same cache key
   */
  private extractImportantContent(noteText: string): string {
    // Remove common date patterns
    let cleaned = noteText
      .toLowerCase()
      // Remove dates like "Jan 1", "January 1", "01/01/2024"
      .replace(
        /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:,?\s*\d{4})?\b/gi,
        '',
      )
      // Remove date formats like "01/01/2024" or "2024-01-01"
      .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '')
      // Remove time patterns like "10:30 AM"
      .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, '')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Create a hash key from note text
   * Same important content = same hash key
   */
  private createCacheKey(noteText: string): string {
    const importantContent = this.extractImportantContent(noteText);
    const hash = crypto
      .createHash('sha256')
      .update(importantContent)
      .digest('hex');

    console.log('Hash cache key created:', {
      originalText: noteText.substring(0, 50) + '...',
      importantContent: importantContent.substring(0, 50) + '...',
      hash: hash.substring(0, 16) + '...',
    });

    return hash;
  }

  /**
   * Get from cache if exists and not expired
   */
  get(noteText: string): unknown | null {
    const key = this.createCacheKey(noteText);
    const entry = this.cache.get(key);

    if (!entry) {
      console.log('Cache miss (not found):', key.substring(0, 16));
      return null;
    }

    // Check if expired
    const ageMinutes = (Date.now() - entry.timestamp) / (1000 * 60);
    if (ageMinutes > entry.ttlMinutes) {
      console.log('Cache expired:', key.substring(0, 16));
      this.cache.delete(key);
      return null;
    }

    console.log('Cache hit!', key.substring(0, 16));
    return entry.value;
  }

  /**
   * Store in cache with TTL
   */
  set(noteText: string, value: unknown, ttlMinutes: number = 1440): void {
    const key = this.createCacheKey(noteText);
    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttlMinutes,
    });

    console.log('Cached:', {
      key: key.substring(0, 16),
      ttlMinutes,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log('Cache cleared');
  }
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️  Deleted from hash cache: ${key}`);
  }
  /**
   * Get cache stats (for monitoring)
   */
  getStats(): { size: number; entries: Array<{ age: number; ttl: number }> } {
    const entries = Array.from(this.cache.values()).map((entry) => ({
      age: (Date.now() - entry.timestamp) / 1000 / 60, // minutes
      ttl: entry.ttlMinutes,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}
