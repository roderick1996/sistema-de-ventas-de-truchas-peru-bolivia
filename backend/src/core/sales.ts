import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Customer, Payment, Sale } from '../entities';
import { r2, todayBO } from '../util';

export class SaleDto {
  @IsDateString() date: string;
  @IsOptional() @IsInt() customerId?: number;
  @IsIn(['NORMAL', 'RETACO']) product: 'NORMAL' | 'RETACO';
  @IsNumber() @IsPositive() arrobas: number;
  @IsNumber() @Min(0) pricePerArroba: number;
  @IsOptional() @IsNumber() @Min(0) total?: number;
  @IsOptional() @IsNumber() @Min(0) amountPaid?: number;
  @IsOptional() @IsBoolean() legacy?: boolean;
  @IsOptional() @IsString() notes?: string;
}
export class PaymentDto {
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() notes?: string;
}
export class CustomerDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class SalesService {
  constructor(@InjectRepository(Sale) private sales: Repository<Sale>, @InjectRepository(Payment) private pays: Repository<Payment>) {}

  decorate(s: Sale) {
    const collected = r2((s.payments || []).reduce((a, p) => a + p.amount, 0));
    const paid = r2(s.amountPaid + collected);
    const balance = r2(s.total - paid - s.writtenOffAmount);
    return { ...s, collected, paid, balance };
  }
  private base() {
    return this.sales.createQueryBuilder('s').leftJoinAndSelect('s.customer', 'c').leftJoinAndSelect('s.payments', 'p');
  }

  async list(q: { from?: string; to?: string; customerId?: any; pending?: string }) {
    const qb = this.base();
    if (q.from) qb.andWhere('s.date >= :from', { from: q.from });
    if (q.to) qb.andWhere('s.date <= :to', { to: q.to });
    if (q.customerId) qb.andWhere('s.customerId = :cid', { cid: +q.customerId });
    qb.orderBy('s.date', 'DESC').addOrderBy('s.id', 'DESC');
    const rows = (await qb.getMany()).map((s) => this.decorate(s));
    return q.pending === 'true' ? rows.filter((r) => r.balance > 0.004) : rows;
  }

  async openSales(customerId?: number) {
    const qb = this.base().where('s.total - s.amountPaid - s.writtenOffAmount > 0.004');
    if (customerId) qb.andWhere('s.customerId = :cid', { cid: customerId });
    qb.orderBy('s.date', 'ASC').addOrderBy('s.id', 'ASC');
    return (await qb.getMany()).map((s) => this.decorate(s)).filter((s) => s.balance > 0.004);
  }

  private calc(dto: SaleDto) {
    const total = r2(dto.total ?? dto.arrobas * dto.pricePerArroba);
    const amountPaid = r2(dto.amountPaid ?? total);
    if (amountPaid > total + 0.004) throw new BadRequestException('Lo pagado no puede ser mayor al total');
    if (amountPaid < total - 0.004 && !dto.customerId) throw new BadRequestException('Para dejar una deuda debes elegir un cliente');
    return { total, amountPaid };
  }

  create(dto: SaleDto, user: any) {
    const sale = this.sales.create({
      date: dto.date,
      customerId: dto.customerId ?? null,
      product: dto.product,
      arrobas: dto.arrobas,
      pricePerArroba: dto.pricePerArroba,
      notes: dto.notes,
      legacy: !!dto.legacy,
      writtenOffAmount: 0,
      createdBy: user?.name,
      ...this.calc(dto),
    });
    return this.sales.save(sale);
  }

  async update(id: number, dto: SaleDto) {
    const sale = await this.sales.findOne({ where: { id }, relations: ['payments'] });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    Object.assign(sale, {
      date: dto.date, customerId: dto.customerId ?? null, product: dto.product, arrobas: dto.arrobas,
      pricePerArroba: dto.pricePerArroba, notes: dto.notes, legacy: !!dto.legacy,
    }, this.calc(dto));
    if (this.decorate(sale).balance < -0.004) throw new BadRequestException('El total no puede ser menor a lo ya cobrado');
    delete (sale as any).payments;
    return this.sales.save(sale);
  }

  async remove(id: number) {
    await this.sales.delete(id);
    return { ok: true };
  }

  async addPayment(id: number, dto: PaymentDto) {
    const sale = await this.sales.findOne({ where: { id }, relations: ['payments'] });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const d = this.decorate(sale);
    if (dto.amount > d.balance + 0.004) throw new BadRequestException(`El saldo de esta venta es Bs ${d.balance}`);
    return this.pays.save(this.pays.create({ saleId: id, amount: dto.amount, date: dto.date || todayBO(), notes: dto.notes }));
  }

  /** Cobra a un cliente repartiendo el monto desde la deuda más antigua */
  async payCustomer(customerId: number, dto: PaymentDto) {
    const open = await this.openSales(customerId);
    const debt = r2(open.reduce((a, s) => a + s.balance, 0));
    if (debt <= 0) throw new BadRequestException('Este cliente no tiene deudas');
    if (dto.amount > debt + 0.004) throw new BadRequestException(`El cliente solo debe Bs ${debt}`);
    let left = dto.amount;
    const date = dto.date || todayBO();
    const applied = [];
    for (const s of open) {
      if (left <= 0.004) break;
      const a = r2(Math.min(left, s.balance));
      await this.pays.save(this.pays.create({ saleId: s.id, amount: a, date, notes: dto.notes }));
      left = r2(left - a);
      applied.push({ saleId: s.id, amount: a });
    }
    return { applied, remaining: r2(debt - dto.amount) };
  }

  async writeOff(id: number) {
    const sale = await this.sales.findOne({ where: { id }, relations: ['payments'] });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const d = this.decorate(sale);
    if (d.balance <= 0.004) throw new BadRequestException('Esta venta no tiene saldo');
    sale.writtenOffAmount = r2(sale.writtenOffAmount + d.balance);
    delete (sale as any).payments;
    return this.sales.save(sale);
  }
}

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private s: SalesService) {}
  @Get() list(@Query() q: any) { return this.s.list(q); }
  @Post() create(@Body() dto: SaleDto, @Req() req: any) { return this.s.create(dto, req.user); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: SaleDto) { return this.s.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.s.remove(id); }
  @Post(':id/payments') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PaymentDto) { return this.s.addPayment(id, dto); }
  @Post(':id/write-off') writeOff(@Param('id', ParseIntPipe) id: number) { return this.s.writeOff(id); }
}

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>, private s: SalesService) {}

  @Get() async list() {
    const [customers, open] = await Promise.all([this.repo.find({ order: { name: 'ASC' } }), this.s.openSales()]);
    const debt = new Map<number, number>();
    for (const o of open) debt.set(o.customerId, r2((debt.get(o.customerId) || 0) + o.balance));
    return customers.map((c) => ({ ...c, debt: debt.get(c.id) || 0 }));
  }
  @Post() create(@Body() dto: CustomerDto) { return this.repo.save(this.repo.create(dto)); }
  @Put(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: CustomerDto) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return this.repo.save(Object.assign(c, dto));
  }
  @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) {
    try { await this.repo.delete(id); return { ok: true }; } catch { throw new ConflictException('No se puede eliminar: el cliente tiene ventas registradas'); }
  }
  @Post(':id/pay') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PaymentDto) { return this.s.payCustomer(id, dto); }
}
