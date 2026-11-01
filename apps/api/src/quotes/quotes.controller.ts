import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { QuotePdfService } from './quote-pdf.service';
import { CreateQuoteDto } from './quotes.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: QuotePdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a configuration as a quote request. Prices are recalculated server-side.' })
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Get(':token')
  @ApiOperation({ summary: 'Public view of a quote by its public token' })
  get(@Param('token') token: string) {
    return this.quotes.findPublic(token);
  }

  @Get(':token/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the quote as PDF' })
  async downloadPdf(@Param('token') token: string, @Res() res: Response) {
    const quote = await this.quotes.findPublic(token);
    const file = await this.pdf.render(quote);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
      'Content-Length': file.length,
    });
    res.end(file);
  }
}
