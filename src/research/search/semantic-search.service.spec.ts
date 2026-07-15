import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchService } from './semantic-search.service';

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SemanticSearchService],
    }).compile();

    service = module.get<SemanticSearchService>(SemanticSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
