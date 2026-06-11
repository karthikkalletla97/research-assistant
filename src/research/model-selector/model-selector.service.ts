import { Injectable } from '@nestjs/common';

@Injectable()
export class ModelSelectorService {
  // Risk keywords that indicate a note needs careful handling
  private readonly riskKeywords = [
    'unhappy',
    'defective',
    'irritated',
    'results not coming up',
    'not encouraging',
    'numbers are down',
  ];

  /**
   * Select which model to use based on note risk level
   * High risk → Opus (accurate, expensive)
   * Low risk → Haiku (fast, cheap)
   */
  selectModel(noteText: string): string {
    const riskLevel = this.detectRisk(noteText);

    if (riskLevel === 'high') {
      console.log('High risk detected, using Opus');
      return 'claude-opus-4-6';
    } else {
      console.log('Low risk, using Haiku');
      return 'claude-haiku-4-5';
    }
  }

  /**
   * Detect if a note has high-risk content
   * HIGH RISK = Contains keywords that indicate customer issue, complaint, urgency
   */
  private detectRisk(noteText: string): 'high' | 'low' {
    const lowerText = noteText.toLowerCase();

    // Count how many risk keywords are found
    const keywordCount = this.riskKeywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    ).length;

    // Threshold: if ANY keyword found, it's high risk
    // (You said you want to experiment with this number)
    const threshold = 1; // Change this to 2, 3, etc. to experiment

    return keywordCount >= threshold ? 'high' : 'low';
  }

  /**
   * Get debug info about risk detection
   * Useful for testing and monitoring
   */
  getDebugInfo(noteText: string): {
    riskLevel: 'high' | 'low';
    matchedKeywords: string[];
    selectedModel: string;
  } {
    const lowerText = noteText.toLowerCase();
    const matchedKeywords = this.riskKeywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    );
    const riskLevel = this.detectRisk(noteText);
    const selectedModel = this.selectModel(noteText);

    return {
      riskLevel,
      matchedKeywords,
      selectedModel,
    };
  }
}
