import { IsString, IsNotEmpty } from 'class-validator';

export class ExtractFactsDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

export class ExtractedFacts {
  name?: string;
  summary!: string;
  topics: string[] = [];
  sentiment: 'positive' | 'neutral' | 'negative' = 'positive';
  confidence: number | undefined; // 0-1, how confident Claude is
}
