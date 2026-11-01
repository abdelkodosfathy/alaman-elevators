import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstimateDto } from './pricing.dto';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('estimate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Price a configuration. Returns the breakdown plus any validation issues.' })
  async estimate(@Body() dto: EstimateDto) {
    const { result } = await this.pricing.estimate(dto.productSlug, dto.selections);
    return result;
  }
}
