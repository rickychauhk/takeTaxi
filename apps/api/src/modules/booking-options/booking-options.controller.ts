import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { BookingOptionsService } from './booking-options.service';

class CategoryDto {
  @IsString()
  code!: string;

  @IsString()
  labelZh!: string;

  @IsString()
  labelEn!: string;

  @IsEnum(['single', 'multi'])
  selectionMode!: 'single' | 'multi';

  @IsEnum(['chip', 'tunnel', 'vehicle'])
  displayStyle!: 'chip' | 'tunnel' | 'vehicle';

  @IsEnum(['preferences', 'extras'])
  screenGroup!: 'preferences' | 'extras';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class PatchCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  labelZh?: string;

  @IsOptional()
  @IsString()
  labelEn?: string;

  @IsOptional()
  @IsEnum(['single', 'multi'])
  selectionMode?: 'single' | 'multi';

  @IsOptional()
  @IsEnum(['chip', 'tunnel', 'vehicle'])
  displayStyle?: 'chip' | 'tunnel' | 'vehicle';

  @IsOptional()
  @IsEnum(['preferences', 'extras'])
  screenGroup?: 'preferences' | 'extras';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class OptionDto {
  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @IsString()
  code!: string;

  @IsString()
  labelZh!: string;

  @IsString()
  labelEn!: string;

  @IsOptional()
  @IsString()
  iconKey?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class PatchOptionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  labelZh?: string;

  @IsOptional()
  @IsString()
  labelEn?: string;

  @IsOptional()
  @IsString()
  iconKey?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller()
export class BookingOptionsController {
  constructor(private readonly service: BookingOptionsService) {}

  @Get('passenger/booking-options')
  listForPassenger() {
    return this.service.listForPassenger();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/booking-option-categories')
  listCategories() {
    return this.service.listCategoriesAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/booking-option-categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.service.createCategory(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/booking-option-categories/:id')
  patchCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/booking-option-categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCategory(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/booking-options')
  listOptions(@Query('categoryId') categoryId?: string) {
    const cid = categoryId ? Number(categoryId) : undefined;
    return this.service.listOptionsAdmin(cid && !Number.isNaN(cid) ? cid : undefined);
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/booking-options')
  createOption(@Body() dto: OptionDto) {
    return this.service.createOption(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/booking-options/:id')
  patchOption(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchOptionDto) {
    return this.service.updateOption(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/booking-options/:id')
  deleteOption(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteOption(id);
  }
}
