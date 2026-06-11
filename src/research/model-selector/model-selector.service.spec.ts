import { Test, TestingModule } from '@nestjs/testing';
import { ModelSelectorService } from './model-selector.service';

describe('ModelSelectorService', () => {
  let service: ModelSelectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModelSelectorService],
    }).compile();

    service = module.get<ModelSelectorService>(ModelSelectorService);
  });

  it('should select Haiku for low-risk notes', () => {
    const lowRiskNote = 'Met with John. Budget approved for Q2.';
    const model = service.selectModel(lowRiskNote);
    expect(model).toBe('claude-3-5-haiku-20241022');
  });

  it('should select Opus for high-risk notes', () => {
    const highRiskNote = 'Customer is unhappy with service quality.';
    const model = service.selectModel(highRiskNote);
    expect(model).toBe('claude-opus-4-20250514');
  });

  it('should detect multiple risk keywords', () => {
    const debugNote =
      'Customer unhappy. Results not coming up. Defective product.';
    const debug = service.getDebugInfo(debugNote);
    console.log(debug);
    expect(debug.riskLevel).toBe('high');
    expect(debug.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('should return debug info with matched keywords', () => {
    const note = 'Customer is unhappy with the service.';
    const debug = service.getDebugInfo(note);
    expect(debug.selectedModel).toBeDefined();
    expect(debug.matchedKeywords).toContain('unhappy');
  });
});
