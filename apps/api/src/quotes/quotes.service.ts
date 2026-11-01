import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateQuoteDto } from './quotes.dto';

const publicSelect = {
  id: true,
  number: true,
  publicToken: true,
  status: true,
  customerName: true,
  city: true,
  breakdown: true,
  selections: true,
  subtotal: true,
  vat: true,
  total: true,
  estimateLow: true,
  estimateHigh: true,
  currency: true,
  createdAt: true,
  product: { select: { slug: true, nameAr: true, nameEn: true, kind: true } },
} satisfies Prisma.QuoteSelect;

export type PublicQuote = Prisma.QuoteGetPayload<{ select: typeof publicSelect }>;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(dto: CreateQuoteDto) {
    const { product, result } = await this.pricing.estimate(dto.productSlug, dto.selections);
    if (!result.valid) {
      throw new UnprocessableEntityException({ message: 'Configuration is not valid', issues: result.issues });
    }

    const quote = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const counter = await tx.counter.upsert({
        where: { key: `quote-${year}` },
        create: { key: `quote-${year}`, value: 1 },
        update: { value: { increment: 1 } },
      });
      return tx.quote.create({
        data: {
          number: `AL-${year}-${String(counter.value).padStart(4, '0')}`,
          productId: product.id,
          customerName: dto.customerName.trim(),
          phone: dto.phone.trim(),
          whatsapp: dto.whatsapp?.trim() || null,
          email: dto.email?.trim() || null,
          city: dto.city?.trim() || null,
          projectType: dto.projectType?.trim() || null,
          notes: dto.notes?.trim() || null,
          source: dto.source ?? 'web',
          selections: result.normalized as Prisma.InputJsonValue,
          breakdown: result.lines as unknown as Prisma.InputJsonValue,
          subtotal: result.subtotal,
          vat: result.vat,
          total: result.total,
          estimateLow: result.estimateLow,
          estimateHigh: result.estimateHigh,
          currency: result.currency,
        },
        select: publicSelect,
      });
    });

    this.webhooks.dispatch('quote.created', { ...quote, phone: dto.phone, email: dto.email ?? null });
    return quote;
  }

  async findPublic(token: string): Promise<PublicQuote> {
    const quote = await this.prisma.quote.findUnique({ where: { publicToken: token }, select: publicSelect });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async list(params: { status?: QuoteStatus; search?: string; page: number; pageSize: number }) {
    const where: Prisma.QuoteWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { number: { contains: params.search, mode: 'insensitive' } },
              { customerName: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { product: { select: { slug: true, nameAr: true } } },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize };
  }

  async get(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { product: { select: { slug: true, nameAr: true } } } });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async updateStatus(id: string, status: QuoteStatus) {
    const quote = await this.prisma.quote.update({ where: { id }, data: { status } }).catch(() => {
      throw new NotFoundException('Quote not found');
    });
    this.webhooks.dispatch('quote.status_changed', { id: quote.id, number: quote.number, status });
    return quote;
  }

  async stats() {
    const [byStatus, totals] = await this.prisma.$transaction([
      this.prisma.quote.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.quote.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    ]);
    return {
      totalQuotes: totals._count._all,
      pipelineValue: totals._sum.total ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, (s._count as { _all: number })._all])),
    };
  }
}
