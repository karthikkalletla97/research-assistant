import { Injectable } from '@nestjs/common';
import { LlmService } from 'src/llm/llm.service';
import { ExtractedFacts } from '../dto/extract-facts.dto';
import { ModelSelectorService } from '../model-selector/model-selector.service';
import { CacheManagerService } from '../cache/cache-manager.service';
import { CircuitBreakerService } from 'src/llm/circuit-breaker.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';

@Injectable()
export class ResearchService {
  constructor(
    private llmService: LlmService,
    private modelSelector: ModelSelectorService,
    private cacheManager: CacheManagerService,
    private circuitBreaker: CircuitBreakerService,
    private monitoringService: MonitoringService,
  ) {}

  async extractFacts(noteText: string): Promise<ExtractedFacts> {
    const startTime = Date.now();
    // TRY CACHE FIRST (using hash-based strategy)
    const cachedResult = this.cacheManager.get(noteText, 'hash');
    if (cachedResult) {
      console.log('✅ Returning cached result');
      return cachedResult as ExtractedFacts;
    }

    console.log('❌ Cache miss, calling Claude API');

    // CHECK CIRCUIT BREAKER
    if (!this.circuitBreaker.canAttempt()) {
      console.log('⚠️ Circuit breaker is OPEN, returning error');
      // Return degraded response
      return {
        name: undefined,
        summary:
          'Service temporarily unavailable. Data from cache unavailable.',
        topics: [],
        sentiment: 'neutral',
        confidence: 0, // Low confidence to indicate degraded
      };
    }

    const prompt = this.buildExtractionPrompt(noteText);
    const model = this.modelSelector.selectModel(noteText);

    let retries = 0;
    while (retries < 3) {
      try {
        // SELECT MODEL BASED ON RISK
        const debugInfo = this.modelSelector.getDebugInfo(noteText);
        console.log('Model selection debug:', debugInfo);

        const response = await this.llmService.callClaude(
          [{ role: 'user', content: prompt }],
          0, // temperature = 0 for consistency
          500, // maxTokens
          model, // PASS THE SELECTED MODEL
        );

        const latencyMs = Date.now() - startTime;
        const costUSD =
          response.usage.input_tokens * 0.000003 +
          response.usage.output_tokens * 0.000015;
        // RECORD SUCCESS IN CIRCUIT BREAKER
        this.monitoringService.recordApiCall(model, true, latencyMs, costUSD);
        this.circuitBreaker.recordSuccess();

        // Clean the response: extract JSON from markdown blocks if needed
        const cleanedText = this.extractJsonFromResponse(response.text);

        // Log for debugging
        console.log('Raw Claude response:', response.text);
        console.log('Cleaned text:', cleanedText);

        // Parse and validate JSON
        const parsed = JSON.parse(cleanedText) as unknown;

        if (!this.isExtractedFacts(parsed)) {
          throw new Error('Invalid response structure');
        }

        const result: ExtractedFacts = {
          name: parsed.name || undefined,
          summary: parsed.summary,
          topics: parsed.topics,
          sentiment: parsed.sentiment || 'neutral',
          confidence: parsed.confidence || 0.8,
        };
        // Store in cache (both hash and semantic for better future hits)
        this.cacheManager.set(noteText, result, 'both', 1440); // 1 day TTL

        return result;
      } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        retries++;
        if (retries >= 3) {
          throw new Error(
            `Failed to extract facts after 3 retries: ${errorMessage}`,
          );
        }
        console.warn(`Retry ${retries}: ${errorMessage}`);
        // RECORD FAILURE IN CIRCUIT BREAKER
        this.monitoringService.recordApiCall(model, false, latencyMs, 0);
        this.circuitBreaker.recordFailure();
        console.error('Failed to extract facts:', error);

        return {
          name: undefined,
          summary: 'Error extracting facts:' + errorMessage,
          topics: [],
          sentiment: 'neutral',
          confidence: 0, // Low confidence to indicate error
        };
      }
    }

    throw new Error('Unexpected error in extractFacts');
  }

  private extractJsonFromResponse(text: string): string {
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // Try to extract JSON from plain code blocks
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    // Try to find JSON object directly (starts with { and ends with })
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0].trim();
    }

    // If nothing worked, return trimmed text and let JSON.parse handle the error
    return text.trim();
  }

  private isExtractedFacts(parsed: unknown): parsed is ExtractedFacts {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const candidate = parsed as Record<string, unknown>;
    const hasSummary = typeof candidate.summary === 'string';
    const hasTopics =
      Array.isArray(candidate.topics) &&
      candidate.topics.every((topic) => typeof topic === 'string');
    const hasSentiment = typeof candidate.sentiment === 'string';
    const hasConfidence = typeof candidate.confidence === 'number';

    return hasSummary && hasTopics && hasSentiment && hasConfidence;
  }

  private buildExtractionPrompt(noteText: string): string {
    return `You are a research assistant extracting facts from CRM notes.
    Extract the following from the provided text:
    - Name (person or company name, if mentioned)
    - Summary (1-2 sentence summary of the note)
    - Topics (list of key topics discussed)
    - Sentiment (positive, neutral, or negative)
    - Confidence (0-1, how confident you are in your extraction)
    
    Return ONLY valid JSON, no other text.
    
    Examples:
    1. Input: "Met with John Smith. He's interested in our product for customer service automation. Very enthusiastic."
       Output: { "name": "John Smith", "summary": "Interested in customer service automation product", "topics": ["customer service", "automation"], "sentiment": "positive", "confidence": 0.95 }
    
    2. Input: "Called Sarah Lee. Budget constraints. Will revisit in Q3."
       Output: { "name": "Sarah Lee", "summary": "Budget constraints, revisit in Q3", "topics": ["budget", "timeline"], "sentiment": "neutral", "confidence": 0.85 }
    
    Now extract key facts from this text:
    TEXT: ${noteText}`;
  }
}
