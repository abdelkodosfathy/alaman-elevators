import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';
import type { Selections } from './pricing.engine';

export class EstimateDto {
  @ApiProperty({ example: 'passenger-elevator' })
  @IsString()
  productSlug: string;

  @ApiProperty({
    description: 'Answers keyed by attribute key: option code for SINGLE, array of codes for MULTI, number for NUMBER',
    example: { usage: 'elv.usage.residential', stops: 6, extras: ['elv.extras.ard'] },
  })
  @IsObject()
  selections: Selections;
}
