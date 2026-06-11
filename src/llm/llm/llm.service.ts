import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

@Injectable()
export class LlmService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('CLAUDE_API_KEY')!;
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY not found in environment variables');
    }
    this.model =
      this.configService.get<string>('CLAUDE_MODEL') || 'claude-opus-4-6';
  }

  async callClaude(
    messages: Message[],
    temperature: number = 0.5,
    maxTokens: number = 1024,
    model?: string,
  ): Promise<{
    text: string;
    usage: { input_tokens: number; output_tokens: number };
  }> {
    try {
      const response = await axios.post<ClaudeResponse>(
        this.apiUrl,
        {
          model: model || this.model,
          max_tokens: maxTokens,
          temperature,
          messages,
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
        },
      );

      return {
        text: response.data.content[0].text,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to call Claude API: ${error.message}`);
    }
  }
}
