import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'List configurable product lines (elevators, escalators, ...)' })
  list() {
    return this.catalog.listProducts();
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Full configurator for a product: steps, attributes, options and compatibility rules' })
  async get(@Param('slug') slug: string) {
    return this.catalog.toPublic(await this.catalog.getTree(slug));
  }
}
