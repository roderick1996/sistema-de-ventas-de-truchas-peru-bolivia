import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Shipment, ShipmentItem, Supplier, SupplierPayment } from '../entities';
import { r2 } from '../util';

class ItemDto {
  @IsIn(['NORMAL', 'RETACO']) product: 'NORMAL' | 'RETACO';
  @IsNumber() @IsPositive() buckets: number;
  @IsOptional() @IsNumber() @IsPositive() kgPerBucket?: number;
  @IsNumber() @Min(0) pricePerKg: number;
}
export class ShipmentDto {
  @IsDateString() date: string;
  @IsInt() supplierId: number;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemDto) items: ItemDto[];
}
export class SupplierDto {
  @IsString() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) openingDebt?: number;
}

@Injectable()
export class PurchasingService {
  constructor(
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(Shipment) private shipments: Repository<Shipment>,
    @InjectRepository(SupplierPayment) private sp: Repository<SupplierPayment>,
  ) {}

  /** Cuánto se compró, pagó y se debe a cada proveedor (en soles) */
  async balances() {
    const [sups, ships, pays] = await Promise.all([this.suppliers.find({ order: { name: 'ASC' } }), this.shipments.find(), this.sp.find()]);
    return sups.map((s) => {
      const mine = ships.filter((x) => x.supplierId === s.id);
      const purchased = r2(mine.reduce((a, sh) => a + sh.items.reduce((t, i) => t + i.buckets * i.kgPerBucket * i.pricePerKg, 0), 0));
      const buckets = r2(mine.reduce((a, sh) => a + sh.items.reduce((t, i) => t + i.buckets, 0), 0));
      const paid = r2(pays.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.soles, 0));
      return { ...s, purchased, buckets, paid, debt: r2(purchased + s.openingDebt - paid) };
    });
  }
}

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(@InjectRepository(Supplier) private repo: Repository<Supplier>, private p: PurchasingService) {}
  @Get() list() { return this.p.balances(); }
  @Post() create(@Body() d: SupplierDto) { return this.repo.save(this.repo.create({ openingDebt: 0, ...d })); }
  @Put(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() d: SupplierDto) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return this.repo.save(Object.assign(s, d));
  }
  @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) {
    try { await this.repo.delete(id); return { ok: true }; } catch { throw new ConflictException('No se puede eliminar: el proveedor tiene registros'); }
  }
}

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(@InjectRepository(Shipment) private repo: Repository<Shipment>, @InjectRepository(ShipmentItem) private items: Repository<ShipmentItem>) {}

  private dec(s: Shipment) {
    return {
      ...s,
      totalSoles: r2(s.items.reduce((t, i) => t + i.buckets * i.kgPerBucket * i.pricePerKg, 0)),
      totalKg: r2(s.items.reduce((t, i) => t + i.buckets * i.kgPerBucket, 0)),
      totalBuckets: r2(s.items.reduce((t, i) => t + i.buckets, 0)),
    };
  }
  private mapItems(dto: ShipmentDto) {
    return dto.items.map((i) => this.items.create({ product: i.product, buckets: i.buckets, kgPerBucket: i.kgPerBucket ?? 35, pricePerKg: i.pricePerKg }));
  }

  @Get() async list(@Query('from') from?: string, @Query('to') to?: string) {
    const where: any = {};
    if (from || to) where.date = from && to ? Between(from, to) : from ? MoreThanOrEqual(from) : LessThanOrEqual(to);
    const rows = await this.repo.find({ where, order: { date: 'DESC', id: 'DESC' } });
    return rows.map((r) => this.dec(r));
  }
  @Post() async create(@Body() dto: ShipmentDto) {
    const s = this.repo.create({ date: dto.date, supplierId: dto.supplierId, notes: dto.notes, items: this.mapItems(dto) });
    return this.repo.save(s);
  }
  @Put(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: ShipmentDto) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Llegada no encontrada');
    await this.items.delete({ shipmentId: id });
    s.date = dto.date; s.supplierId = dto.supplierId; s.notes = dto.notes;
    delete (s as any).supplier;
    s.items = this.mapItems(dto);
    return this.repo.save(s);
  }
  @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) {
    await this.repo.delete(id);
    return { ok: true };
  }
}
