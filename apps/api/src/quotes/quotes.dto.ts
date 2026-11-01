import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { Selections } from '../pricing/pricing.engine';

export class CreateQuoteDto {
  @ApiProperty({ example: 'passenger-elevator' })
  @IsString()
  productSlug: string;

  @ApiProperty({ example: { stops: 6, usage: 'elv.usage.residential' } })
  @IsObject()
  selections: Selections;

  @ApiProperty({ example: 'أحمد محمد' })
  @IsString()
  @Length(2, 120)
  customerName: string;

  @ApiProperty({ example: '01000146844' })
  @Matches(/^\+?[0-9\s-]{8,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{8,20}$/, { message: 'رقم الواتساب غير صحيح' })
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' })
  email?: string;

  @ApiPropertyOptional({ example: 'الشروق' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  city?: string;

  @ApiPropertyOptional({ example: 'فيلا' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  projectType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Calling platform identifier', example: 'web' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  source?: string;
}

export const QUOTE_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'] as const;

export class UpdateQuoteStatusDto {
  @ApiProperty({ enum: QUOTE_STATUSES })
  @IsIn(QUOTE_STATUSES)
  status: (typeof QUOTE_STATUSES)[number];
}
