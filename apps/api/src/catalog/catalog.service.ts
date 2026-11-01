import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EngineProduct } from '../pricing/pricing.engine';

const treeInclude = (activeOnly: boolean) =>
  ({
    steps: {
      orderBy: { sortOrder: 'asc' },
      include: {
        attributes: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              where: activeOnly ? { isActive: true } : undefined,
              orderBy: { sortOrder: 'asc' },
              include: { rules: { include: { target: { select: { code: true } } } } },
            },
          },
        },
      },
    },
  }) satisfies Prisma.ProductInclude;

export type ProductTree = Prisma.ProductGetPayload<{ include: ReturnType<typeof treeInclude> }>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listProducts() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, kind: true, nameAr: true, nameEn: true, descriptionAr: true, imageUrl: true, basePrice: true },
    });
  }

  async getTree(slug: string, activeOnly = true): Promise<ProductTree> {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...(activeOnly ? { isActive: true } : {}) },
      include: treeInclude(activeOnly),
    });
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  /** Public, client-friendly shape of the configurator. */
  toPublic(p: ProductTree) {
    return {
      id: p.id,
      slug: p.slug,
      kind: p.kind,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      imageUrl: p.imageUrl,
      basePrice: p.basePrice,
      steps: p.steps.map((s) => ({
        key: s.key,
        titleAr: s.titleAr,
        titleEn: s.titleEn,
        descriptionAr: s.descriptionAr,
        attributes: s.attributes.map((a) => ({
          key: a.key,
          labelAr: a.labelAr,
          labelEn: a.labelEn,
          helpAr: a.helpAr,
          inputType: a.inputType,
          required: a.required,
          min: a.min,
          max: a.max,
          defaultValue: a.defaultValue,
          unitAr: a.unitAr,
          includedUnits: a.includedUnits,
          unitPrice: a.unitPrice,
          options: a.options.map((o) => ({
            code: o.code,
            labelAr: o.labelAr,
            labelEn: o.labelEn,
            descriptionAr: o.descriptionAr,
            imageUrl: o.imageUrl,
            swatch: o.swatch,
            priceType: o.priceType,
            price: o.price,
            unitAttributeKey: o.unitAttributeKey,
            isDefault: o.isDefault,
          })),
        })),
      })),
      rules: this.rules(p),
    };
  }

  toEngine(p: ProductTree): EngineProduct {
    return {
      slug: p.slug,
      nameAr: p.nameAr,
      basePrice: p.basePrice,
      attributes: p.steps.flatMap((s) =>
        s.attributes.map((a) => ({
          key: a.key,
          labelAr: a.labelAr,
          inputType: a.inputType,
          required: a.required,
          min: a.min,
          max: a.max,
          defaultValue: a.defaultValue,
          unitAr: a.unitAr,
          includedUnits: a.includedUnits,
          unitPrice: a.unitPrice,
          options: a.options.map((o) => ({
            code: o.code,
            labelAr: o.labelAr,
            priceType: o.priceType,
            price: o.price,
            unitAttributeKey: o.unitAttributeKey,
            isActive: o.isActive,
            isDefault: o.isDefault,
          })),
        })),
      ),
      rules: this.rules(p),
    };
  }

  private rules(p: ProductTree) {
    return p.steps.flatMap((s) =>
      s.attributes.flatMap((a) =>
        a.options.flatMap((o) =>
          o.rules.map((r) => ({ type: r.type, optionCode: o.code, targetCode: r.target.code, messageAr: r.messageAr })),
        ),
      ),
    );
  }
}
