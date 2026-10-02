import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  upsert(@Body() dto: UpsertProductDto) {
    return this.productsService.upsert(dto.productId, dto.available);
  }

  @Get(':productId')
  get(@Param('productId') productId: string) {
    return this.productsService.get(productId);
  }
}
