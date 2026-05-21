import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ExtractFactsDto, ExtractedFacts } from '../dto/extract-facts.dto';
import { ResearchService } from './research.service';

@Controller('research')
export class ResearchController {
  constructor(private researchService: ResearchService) {}

  @Post('extract-facts')
  @HttpCode(200)
  async extractFacts(@Body() dto: ExtractFactsDto): Promise<ExtractedFacts> {
    return this.researchService.extractFacts(dto.note);
  }
}
