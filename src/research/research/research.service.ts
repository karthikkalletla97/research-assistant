import { Injectable } from '@nestjs/common';
import { LlmService } from 'src/llm/llm/llm.service';
import { ExtractedFacts } from '../dto/extract-facts.dto';

@Injectable()
export class ResearchService {
    constructor(private llmService: LlmService) { }

    async extractFacts(noteText: string): Promise<ExtractedFacts> {
        const prompt = this.buildExtractionPrompt(noteText);

        let retries = 0;
        while (retries < 3) {
            try {
                const response = await this.llmService.callClaude(
                    [{ role: 'user', content: prompt }],
                    0, // temperature = 0 for consistency
                    500, // maxTokens
                );

                // Clean the response: extract JSON from markdown blocks if needed
                const cleanedText = this.extractJsonFromResponse(response.text);

                // Log for debugging
                console.log('Raw Claude response:', response.text);
                console.log('Cleaned text:', cleanedText);

                // Parse and validate JSON
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const parsed = JSON.parse(cleanedText);

                // Basic validation
                if (!parsed.summary || !Array.isArray(parsed.topics)) {
                    throw new Error('Invalid response structure');
                }

                return {
                    name: parsed.name || undefined,
                    summary: parsed.summary,
                    topics: parsed.topics,
                    sentiment: parsed.sentiment || 'neutral',
                    confidence: parsed.confidence || 0.8,
                };
            } catch (error) {
                retries++;
                if (retries >= 3) {
                    throw new Error(
                        `Failed to extract facts after 3 retries: ${error.message}`,
                    );
                }
                console.warn(`Retry ${retries}: ${error.message}`);
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
    
    Now extract from this text:
    TEXT: ${noteText}`;
    }
}
