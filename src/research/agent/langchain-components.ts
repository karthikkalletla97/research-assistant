import { PromptTemplate } from '@langchain/core/prompts';
import { ChatAnthropic } from '@langchain/anthropic';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Component 1: Retrieval (Get top-100 candidates)
 */
export async function retrievalStep(query: string, ragService: any) {
  console.log(`🔍 Retrieval: Fetching candidates for "${query}"`);
  const candidates = await ragService.retrieveChunks(query, 100);
  console.log(`   Retrieved ${candidates.length} candidates`);
  return candidates;
}

/**
 * Component 2: Selection (Score and fit in token budget)
 */
export function createSelectionChain(agentService: any) {
  return async (candidates: any[]) => {
    console.log(`🧠 Selection: Scoring ${candidates.length} candidates`);
    const selected = agentService.selectBestChunks(candidates, 5000);
    console.log(`   Selected ${selected.length} chunks`);
    return selected;
  };
}

/**
 * Component 3: Generation (LLM with CoT)
 */
export function createGenerationChain(isComplex: boolean, llmService: any) {
  const simplePrompt = PromptTemplate.fromTemplate(`
You are a CRM assistant helping sales teams understand customer relationships.

Context:
{context}

Question: {question}

Answer directly and concisely.
`);

  const complexPrompt = PromptTemplate.fromTemplate(`
You are a CRM assistant helping sales teams make strategic decisions.

Context:
{context}

Question: {question}

Show your reasoning step-by-step:

1. ANALYZE THE SITUATION
   What information from the context is relevant?

2. KEY FACTORS
   What are the important considerations?

3. COMPARISON/EVALUATION
   How do the factors compare?

4. CONCLUSION
   Based on the analysis, what's the answer?

Let me think through this:
`);

  const prompt = isComplex ? complexPrompt : simplePrompt;

  const model = new ChatAnthropic({
    apiKey: process.env.CLAUDE_API_KEY,
    model: isComplex ? 'claude-opus-4-6' : 'claude-haiku-4-5',
    temperature: 0.2,
  });

  const parser = new StringOutputParser();

  // Chain: Prompt → Model → Parser
  const chain = prompt.pipe(model).pipe(parser);

  return chain;
}

/**
 * Component 4: Complexity Detection
 */
export function detectComplexity(query: string): boolean {
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

  if (simpleKeywords.some((kw) => queryLower.startsWith(kw))) {
    return false;
  }

  if (complexKeywords.some((kw) => queryLower.includes(kw))) {
    return true;
  }

  return false;
}
