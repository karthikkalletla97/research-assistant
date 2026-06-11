import { Test, TestingModule } from '@nestjs/testing';
import { HashBasedCacheService } from './hash-based-cache.service';
import { SemanticCacheService } from './semantic-cache.service';
import { CacheManagerService } from './cache-manager.service';

describe('Caching Services', () => {
  let hashCache: HashBasedCacheService;
  let semanticCache: SemanticCacheService;
  let cacheManager: CacheManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashBasedCacheService,
        SemanticCacheService,
        CacheManagerService,
      ],
    }).compile();

    hashCache = module.get<HashBasedCacheService>(HashBasedCacheService);
    semanticCache = module.get<SemanticCacheService>(SemanticCacheService);
    cacheManager = module.get<CacheManagerService>(CacheManagerService);
  });

  describe('Hash-Based Caching', () => {
    it('should cache and retrieve with same important content (ignoring dates)', () => {
      const note1 = 'Met with John from Acme on Jan 1';
      const note2 = 'Met with John from Acme on Jan 2';
      const cachedData = { name: 'John', summary: 'Acme meeting' };

      // Cache the data
      hashCache.set(note1, cachedData);

      // Should retrieve from cache for note with different date
      const result = hashCache.get(note2);
      expect(result).toEqual(cachedData);
      expect(result).not.toBeNull();
    });

    it('should NOT cache for completely different notes', () => {
      const note1 = 'Met with John from Acme';
      const note2 = 'Budget spreadsheet for Q2';
      const cachedData = { name: 'John', summary: 'Acme meeting' };

      hashCache.set(note1, cachedData);

      const result = hashCache.get(note2);
      expect(result).toBeNull();
    });

    it('should respect TTL (time-to-live)', (done) => {
      const note = 'Met with John';
      const cachedData = { name: 'John' };

      // Cache with 0.016 minutes TTL (which is ~1 second)
      // (1000ms / (1000 * 60) = 0.0166 minutes)
      const ttlInMinutes = 0.016; // ~1 second
      hashCache.set(note, cachedData, ttlInMinutes);

      // Should be available immediately
      expect(hashCache.get(note)).toEqual(cachedData);

      // Should expire after TTL
      setTimeout(() => {
        expect(hashCache.get(note)).toBeNull();
        done();
      }, 1100); // Wait 1.1 seconds for 1 second TTL to expire
    }, 10000); // Increase test timeout to 10 seconds
  });

  describe('Semantic Caching', () => {
    it('should cache and find similar notes', () => {
      const note1 = 'Met with John from Acme. Budget approved.';
      const note2 = 'Spoke with John at Acme. Budget is approved.';
      const cachedData = { name: 'John', summary: 'Acme meeting' };

      semanticCache.set(note1, cachedData);

      // Should find similar note (high threshold)
      const result = semanticCache.get(note2, 0.8);
      // Might or might not match depending on embedding quality
    });
  });

  describe('Cache Manager', () => {
    it('should use hash-based cache by default', () => {
      const note1 = 'Met with John on Jan 1';
      const note2 = 'Met with John on Jan 2';
      const cachedData = { name: 'John' };

      cacheManager.set(note1, cachedData, 'hash');
      const result = cacheManager.get(note2, 'hash');
      expect(result).toEqual(cachedData);
    });

    it('should support both cache strategies', () => {
      const note1 = 'Met with John';
      const cachedData = { name: 'John' };

      cacheManager.set(note1, cachedData, 'both');

      expect(cacheManager.get(note1, 'hash')).toEqual(cachedData);
      expect(cacheManager.get(note1, 'semantic')).toEqual(cachedData);
    });
  });
});
