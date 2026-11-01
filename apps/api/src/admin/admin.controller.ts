import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma, QuoteStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUOTE_STATUSES, UpdateQuoteStatusDto } from '../quotes/quotes.dto';
import { QuotesService } from '../quotes/quotes.service';
import {
  CreateOptionDto,
  CreateRuleDto,
  CreateWebhookDto,
  LoginDto,
  UpdateAttributeDto,
  UpdateOptionDto,
  UpdateProductDto,
  UpdateWebhookDto,
} from './admin.dto';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

const notFound = (what: string) => (e: unknown) => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new NotFoundException(`${what} not found`);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(`${what} already exists`);
  throw e;
};

@ApiTags('admin: auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange admin credentials for a bearer token' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}

@ApiTags('admin: catalog')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('products')
  @ApiOperation({ summary: 'All products including inactive ones' })
  products() {
    return this.prisma.product.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Full editable tree of a product (ids included, inactive options included)' })
  product(@Param('slug') slug: string) {
    return this.catalog.getTree(slug, false);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data: dto }).catch(notFound('Product'));
  }

  @Patch('attributes/:id')
  updateAttribute(@Param('id') id: string, @Body() dto: UpdateAttributeDto) {
    return this.prisma.attribute.update({ where: { id }, data: dto }).catch(notFound('Attribute'));
  }

  @Post('attributes/:id/options')
  createOption(@Param('id') attributeId: string, @Body() dto: CreateOptionDto) {
    return this.prisma.option.create({ data: { ...dto, attributeId } }).catch(notFound('Option'));
  }

  @Patch('options/:id')
  updateOption(@Param('id') id: string, @Body() dto: UpdateOptionDto) {
    return this.prisma.option.update({ where: { id }, data: dto }).catch(notFound('Option'));
  }

  @Delete('options/:id')
  @HttpCode(204)
  async deleteOption(@Param('id') id: string) {
    await this.prisma.option.delete({ where: { id } }).catch(notFound('Option'));
  }

  @Post('rules')
  async createRule(@Body() dto: CreateRuleDto) {
    const [option, target] = await Promise.all([
      this.prisma.option.findUnique({ where: { code: dto.optionCode } }),
      this.prisma.option.findUnique({ where: { code: dto.targetCode } }),
    ]);
    if (!option || !target) throw new BadRequestException('Unknown option code');
    return this.prisma.optionRule
      .create({ data: { type: dto.type, optionId: option.id, targetId: target.id, messageAr: dto.messageAr } })
      .catch(notFound('Rule'));
  }

  @Delete('rules/:id')
  @HttpCode(204)
  async deleteRule(@Param('id') id: string) {
    await this.prisma.optionRule.delete({ where: { id } }).catch(notFound('Rule'));
  }
}

@ApiTags('admin: quotes')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get('stats')
  stats() {
    return this.quotes.stats();
  }

  @Get('quotes')
  @ApiQuery({ name: 'status', required: false, enum: QUOTE_STATUSES })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(
    @Query('status') status?: QuoteStatus,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    if (status && !QUOTE_STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    return this.quotes.list({ status, search: search?.trim() || undefined, page: Math.max(1, page), pageSize: Math.min(100, Math.max(1, pageSize)) });
  }

  @Get('quotes/:id')
  get(@Param('id') id: string) {
    return this.quotes.get(id);
  }

  @Patch('quotes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.quotes.updateStatus(id, dto.status);
  }
}

@ApiTags('admin: webhooks')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/webhooks')
export class AdminWebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Post()
  @ApiOperation({ summary: 'Register an outgoing webhook. The generated secret is used to sign deliveries.' })
  create(@Body() dto: CreateWebhookDto) {
    return this.prisma.webhook.create({ data: { ...dto, secret: randomBytes(24).toString('hex') } });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.prisma.webhook.update({ where: { id }, data: dto }).catch(notFound('Webhook'));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.prisma.webhook.delete({ where: { id } }).catch(notFound('Webhook'));
  }
}
