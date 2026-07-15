import { Injectable, BadRequestException } from '@nestjs/common';
import { SemanticSearchService } from '../search/semantic-search.service';
import { LlmService } from 'src/llm/llm.service';
import { RagService } from '../rag/rag.service';
import { CacheManagerService } from '../cache/cache-manager.service';
import { createContextAgentGraph } from './langgraph-workflow';

interface AgentState {
  query: string;
  intent: string;
  step: number;
  searchResults: any[];
  extractedFacts: any[];
  synthesis: string;
  recommendations: string[];
  goalAchieved: boolean;
  history: string[];
}

interface AgentAnalysis {
  query: string;
  analysis: string;
  findings: any[];
  recommendations: string[];
  metadata: {
    stepsExecuted: number;
    notesAnalyzed: number;
    executionTime: number;
  };
}

interface AnalysisResponse {
  response: string;
  isComplexQuery: boolean;
  tokensUsed: number;
  estimatedCost: string;
  metadata?: {
    fromCache: boolean;
    candidatesRetrieved: number;
    chunksSelected: number;
    contextTokens: number;
    latencyMs: number;
    contextUtilization: string;
  };
}

@Injectable()
export class AgentService {
  private readonly MAX_STEPS = 10;
  private readonly BROADER_TERMS = {
    budget: ['budget', 'financial', 'money', 'cost', 'expense'],
    timeline: ['timeline', 'schedule', 'deadline', 'date'],
    meeting: ['meeting', 'discussion', 'call', 'conversation'],
  };

  constructor(
    private semanticSearchService: SemanticSearchService,
    private llmService: LlmService,
    private ragService: RagService,
    private cacheManager: CacheManagerService,
  ) {}

  /**
   * Analyze query using agent pattern
   * Multi-step orchestration: search → extract → synthesize → recommend
   */
  async analyze(query: string): Promise<AnalysisResponse> {
    const overallStart = Date.now();

    // STEP 1: Check response cache
    const cacheKey = `response:${query.toLowerCase()}`;
    const cachedResponse = this.cacheManager.get(
      cacheKey,
      'hash',
    ) as AnalysisResponse | null;

    if (
      cachedResponse &&
      (cachedResponse.metadata?.candidatesRetrieved ?? 0) > 0
    ) {
      console.log(`💾 Cache HIT: Returning cached response`);
      return {
        ...cachedResponse,
        metadata: {
          ...cachedResponse.metadata!,
          fromCache: true,
          latencyMs: Date.now() - overallStart,
        },
      };
    }

    if (cachedResponse) {
      console.log(`⚠️  Stale cache (no results): Clearing and running fresh`);
      this.cacheManager.delete(cacheKey, 'hash');
    }

    console.log(`⚡ Cache MISS: Running full workflow`);

    // STEP 2: Create and run the graph
    const graph = createContextAgentGraph(this.ragService, this);

    const result = await graph.invoke({
      query,
      isComplex: false,
      candidates: [],
      selectedChunks: [],
      context: '',
      response: '',
      error: null,
      metadata: {
        classifyTime: 0,
        retrieveTime: 0,
        selectTime: 0,
        generateTime: 0,
      },
    });

    const duration = Date.now() - overallStart;

    const analysisResponse: AnalysisResponse = {
      response: result.response,
      isComplexQuery: result.isComplex,
      tokensUsed: result.context.length / 4,
      estimatedCost: result.isComplex ? '$0.003' : '$0.001',
      metadata: {
        fromCache: false,
        candidatesRetrieved: result.candidates.length,
        chunksSelected: result.selectedChunks.length,
        contextTokens: Math.ceil(result.context.length / 4),
        latencyMs: duration,
        contextUtilization: `${((Math.ceil(result.context.length / 4) / 5000) * 100).toFixed(1)}%`,
      },
    };

    // STEP 3: Cache ONLY if we got results
    if ((analysisResponse.metadata?.candidatesRetrieved ?? 0) > 0) {
      this.cacheManager.set(cacheKey, analysisResponse, 'hash', 30);
      console.log(`💾 Cached response (30 min TTL)`);
    } else {
      console.log(`⚠️  Not caching empty result`);
    }

    return analysisResponse;
  }

  private isComplexQuery(query: string): boolean {
    const complexKeywords = [
      'why',
      'compare',
      'which',
      'best',
      'strategy',
      'approach',
      'analyze',
      'relate',
      'recommend',
      'prioritize',
    ];

    const simpleKeywords = ['when', "what's their", 'list', 'has', 'who is'];

    const queryLower = query.toLowerCase();

    // If simple keyword at start → simple query
    if (simpleKeywords.some((kw) => queryLower.startsWith(kw))) {
      return false;
    }

    // If complex keyword → complex query
    if (complexKeywords.some((kw) => queryLower.includes(kw))) {
      return true;
    }

    // Default: assume simple (cost-conscious)
    return false;
  }

  private buildSimpleQueryPrompt(query: string, context: string): string {
    return `You are a CRM assistant helping sales teams understand their customer relationships.

Retrieved customer notes:
${context}

Question: ${query}

Answer directly and concisely.`;
  }

  private buildComplexQueryPrompt(query: string, context: string): string {
    return `You are a CRM assistant helping sales teams make strategic decisions.

Retrieved customer notes:
${context}

Question: ${query}

Show your reasoning step-by-step:

1. ANALYZE THE SITUATION
   What information from the notes is relevant?

2. KEY FACTORS
   What are the important considerations?

3. COMPARISON/EVALUATION (if applicable)
   How do the factors compare or evaluate?

4. CONCLUSION
   Based on the analysis, what's the answer?

Let me think through this:`;
  }

  /**
   * STEP 1: Parse query intent using keywords + Claude for complex queries
   */
  private async parseIntent(state: AgentState): Promise<void> {
    state.step = 1;
    console.log(`\n📝 STEP ${state.step}: Parse Intent`);

    const query = state.query.toLowerCase();

    // Try simple keyword matching first (fast, free)
    const keywords = ['budget', 'timeline', 'meeting', 'financial', 'cost'];
    let detectedIntent = '';

    for (const keyword of keywords) {
      if (query.includes(keyword)) {
        detectedIntent = keyword;
        break;
      }
    }

    // If not found, use Claude for complex intent (Option 3: hybrid)
    if (!detectedIntent) {
      console.log('  Using Claude for intent detection...');

      const response = await this.llmService.callClaude(
        [
          {
            role: 'user',
            content: `What is the main topic/intent of this query? Return only the topic in 1-2 words.
Query: "${state.query}"`,
          },
        ],
        0.3, // Lower temperature for deterministic response
        100, // Short response
        'claude-haiku-4-5', // Use cheaper model for simple task
      );

      detectedIntent = response.text.toLowerCase().trim();
    }

    state.intent = detectedIntent;
    state.history.push(`Intent detected: ${detectedIntent}`);
    console.log(`  ✓ Intent: "${detectedIntent}"`);
  }

  /**
   * STEP 2: Semantic search with fallback (Option B + 3)
   */
  private async searchNotes(state: AgentState): Promise<void> {
    state.step = 2;
    console.log(`\n🔍 STEP ${state.step}: Search Notes`);

    // Try primary search with original query
    let results = await this.semanticSearchService.search(state.query, 5, 0.3);
    state.history.push(
      `Search 1: "${state.query}" → ${results.length} results`,
    );

    // If no results, try broader search (Option 2: fallback)
    if (results.length === 0) {
      console.log('  No results, trying broader search...');

      // Use broader terms for the detected intent
      const broaderTerms = this.BROADER_TERMS[state.intent] || [state.intent];
      for (const term of broaderTerms) {
        results = await this.semanticSearchService.search(term, 5, 0.2);
        state.history.push(
          `Fallback search: "${term}" → ${results.length} results`,
        );

        if (results.length > 0) {
          console.log(
            `  ✓ Found ${results.length} results with broader search`,
          );
          break;
        }
      }
    }

    // If still no results, notify
    if (results.length === 0) {
      state.history.push('No notes found after fallback searches');
      console.log('  ⚠️  No results found');
      state.searchResults = [];
      return;
    }

    state.searchResults = results;
    console.log(`  ✓ Found ${results.length} relevant notes`);
  }

  /**
   * STEP 3: Extract facts from search results
   */
  private async extractFacts(state: AgentState): Promise<void> {
    state.step = 3;
    console.log(`\n📊 STEP ${state.step}: Extract Facts`);

    const facts = state.searchResults.map((result) => ({
      noteText: result.noteText,
      similarity: result.similarity,
      extractedFacts: result.extractedFacts,
    }));

    state.extractedFacts = facts;
    state.history.push(`Extracted facts from ${facts.length} notes`);
    console.log(`  ✓ Extracted facts from ${facts.length} notes`);
  }

  /**
   * STEP 4: Synthesize findings into coherent analysis
   */
  private async synthesize(state: AgentState): Promise<void> {
    state.step = 4;
    console.log(`\n📋 STEP ${state.step}: Synthesize Findings`);

    // Build synthesis from extracted facts
    const factsText = state.extractedFacts
      .map(
        (f, idx) =>
          `Note ${idx + 1}: "${f.noteText.substring(0, 80)}..."\nTopics: ${f.extractedFacts.topics?.join(', ') || 'N/A'}\nSentiment: ${f.extractedFacts.sentiment}`,
      )
      .join('\n\n');

    const synthesisPrompt = `Synthesize these findings into a clear, concise summary:

${factsText}

Original Query: ${state.query}

Provide a 2-3 sentence summary that directly answers the query.`;

    const response = await this.llmService.callClaude(
      [
        {
          role: 'user',
          content: synthesisPrompt,
        },
      ],
      0.5,
      300,
      'claude-haiku-4-5',
    );

    state.synthesis = response.text;
    state.history.push('Synthesized findings');
    console.log(`  ✓ Synthesis complete`);
  }

  /**
   * STEP 5: Generate recommendations (Option 1 for portfolio: templates)
   */
  private async generateRecommendations(state: AgentState): Promise<void> {
    state.step = 5;
    console.log(`\n💡 STEP ${state.step}: Generate Recommendations`);

    // For portfolio: Use templates (Option 1 - simple, cost-effective)
    const recommendations: string[] = [];

    // Template-based recommendations based on intent
    if (state.intent.includes('budget')) {
      recommendations.push('Review budget allocation and constraints');
      recommendations.push('Schedule budget planning meeting');
      recommendations.push('Document budget decisions in notes');
    }

    if (state.intent.includes('timeline')) {
      recommendations.push('Confirm timeline with stakeholders');
      recommendations.push('Create milestone schedule');
      recommendations.push('Track timeline progress');
    }

    if (state.intent.includes('meeting')) {
      recommendations.push('Document meeting outcomes');
      recommendations.push('Share notes with attendees');
      recommendations.push('Create action items');
    }

    if (state.intent.includes('financial')) {
      recommendations.push('Review financial constraints');
      recommendations.push('Plan resource allocation');
      recommendations.push('Track spending and costs');
    }

    // If no specific recommendations, add generic
    if (recommendations.length === 0) {
      recommendations.push('Review relevant notes');
      recommendations.push('Follow up on findings');
      recommendations.push('Update project status');
    }

    state.recommendations = recommendations;
    state.history.push(`Generated ${recommendations.length} recommendations`);
    console.log(`  ✓ Generated ${recommendations.length} recommendations`);
  }

  /**
   * Get agent execution history (for debugging)
   */
  getHistory(state: AgentState): string[] {
    return state.history;
  }

  /**
   * Estimate tokens in text (rough calculation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough: 1 token ≈ 4 characters
  }

  /**
   * Calculate recency score (newer = higher)
   */
  private calculateRecencyScore(createdAt: Date): number {
    const daysSinceCreated =
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const halfLife = 30; // Decay over 30 days
    return Math.exp(-daysSinceCreated / halfLife);
  }

  /**
   * Score chunk by importance
   */
  private scoreChunkImportance(chunk: any): number {
    const relevanceScore = chunk.similarity || 0.01;
    const recencyScore = chunk.createdAt
      ? this.calculateRecencyScore(chunk.createdAt)
      : 0.5;

    // Higher weight on relevance, some weight on recency
    return 0.7 * relevanceScore + 0.3 * recencyScore;
  }

  /**
   * Select best chunks within token budget
   */
  private selectBestChunks(chunks: any[], maxTokens: number = 5000): any[] {
    if (chunks.length === 0) {
      return [];
    }

    // Score each chunk
    const scored = chunks.map((chunk) => ({
      ...chunk,
      importance: this.scoreChunkImportance(chunk),
    }));

    // Sort by importance (highest first)
    const sorted = scored.sort((a, b) => b.importance - a.importance);

    // Fit within token budget
    const selected: any[] = [];
    let cumulativeTokens = 0;

    for (const chunk of sorted) {
      const chunkTokens = this.estimateTokens(chunk.text);
      if (cumulativeTokens + chunkTokens <= maxTokens) {
        selected.push(chunk);
        cumulativeTokens += chunkTokens;
      }
    }

    console.log(
      `📊 Context selection: ${chunks.length} → ${selected.length} chunks, ` +
        `${cumulativeTokens} / ${maxTokens} tokens (${((cumulativeTokens / maxTokens) * 100).toFixed(1)}%)`,
    );

    return selected;
  }

  /**
   * Order chunks for readability (chronological)
   */
  private orderChunks(chunks: any[]): any[] {
    if (!chunks || chunks.length === 0) {
      return chunks;
    }

    // Try to sort by createdAt if available, else keep order
    const hasCreatedAt = chunks.some((c) => c.createdAt);

    if (hasCreatedAt) {
      return [...chunks].sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return aTime - bTime; // Chronological order
      });
    }

    return chunks;
  }
}
