import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { WEBHOOK_EVENTS } from '../webhooks/webhooks.service';

export class LoginDto {
  @ApiProperty({ example: 'admin@alaman.local' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) basePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAttributeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() labelAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() helpAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() min?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() max?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() defaultValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) includedUnits?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) unitPrice?: number;
}

export class CreateOptionDto {
  @ApiProperty({ example: 'elv.walls.rose-gold' })
  @Matches(/^[a-z0-9.\-_]+$/)
  code: string;

  @ApiProperty() @IsString() @Length(1, 120) labelAr: string;
  @ApiProperty() @IsString() @Length(1, 120) labelEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ example: '#c9a227' }) @IsOptional() @IsString() swatch?: string;
  @ApiPropertyOptional({ enum: ['FIXED', 'PER_UNIT', 'PERCENT'] }) @IsOptional() @IsIn(['FIXED', 'PER_UNIT', 'PERCENT']) priceType?: 'FIXED' | 'PER_UNIT' | 'PERCENT';
  @ApiPropertyOptional({ description: 'May be negative for discounts' }) @IsOptional() @IsInt() price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unitAttributeKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateOptionDto extends PartialType(CreateOptionDto) {}

export class CreateRuleDto {
  @ApiProperty({ enum: ['REQUIRES', 'EXCLUDES'] }) @IsIn(['REQUIRES', 'EXCLUDES']) type: 'REQUIRES' | 'EXCLUDES';
  @ApiProperty({ description: 'Option code' }) @IsString() optionCode: string;
  @ApiProperty({ description: 'Target option code' }) @IsString() targetCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() messageAr?: string;
}

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://crm.example.com/hooks/alaman' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {}
