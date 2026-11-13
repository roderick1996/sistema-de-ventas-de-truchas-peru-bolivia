import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BadRequestException, Body, Controller, Delete, Get, Injectable, Param, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyClosing, DailyClosingLine, Exchange, Expense, Payment, Shipment } from '../entities';
import { addDaysISO, diffDays, r2, todayBO } from '../util';
import { SalesService } from './sales';
import { SettingsService } from './settings';

class LineDto {
  @IsInt() supplierId: number;
  @IsIn(['NORMAL', 'RETACO']) product: 'NORMAL' | 'RETACO';
  @IsNumber() @Min(0) bucketsSold: number;
  @IsNumber() @IsPositive() kgPerBucket: number;
  @IsNumber() @Min(0) pricePerKg: number;
}
export class ClosingDto {
  @IsNumber() @IsPositive() rate: number;
  @IsOptional() @IsNumber() @Min(0) cashCounted?: number;
  @IsOptional() @IsBoolean() cashIncludesCollections?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
}

const checkDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw new BadRequestException('Fecha inválida');
  return d;
};
const sum = (a: any[], f: (x: any) => number) => r2(a.reduce((t, x) => t + f(x), 0));

@Injectable()
export class ClosingsService {
  constructor(
    @InjectRepository(DailyClosing) private closings: Repository<DailyClosing>,
    @InjectRepository(DailyClosingLine) private lines: Repository<DailyClosingLine>,
    @InjectRepository(Payment) private pays: Repository<Payment>,
    @InjectRepository(Expense) private expenses: Repository<Expense>,
    @InjectRepository(Shipment) private shipments: Repository<Shipment>,
    @InjectRepository(Exchange) private exchanges: Repository<Exchange>,
    private salesSvc: SalesService,
    private settings: SettingsService,
  ) {}

  /** cubetas × kg × S/kilo = soles; × tipo de cambio = bolivianos a reponer */
  static calc(c: DailyClosing) {
    const bucketsSold = sum(c.lines, (l) => l.bucketsSold);
    const kgSold = sum(c.lines, (l) => l.bucketsSold * l.kgPerBucket);
    const solesCost = sum(c.lines, (l) => l.bucketsSold * l.kgPerBucket * l.pricePerKg);
    return { bucketsSold, kgSold, solesCost, costBs: r2(solesCost * c.rate) };
  }

  /**
   * Cifras del día. Si se contó el efectivo:
   *   ventas = efectivo − cobros de deudas antiguas + fiado + gastos (ya salieron del efectivo)
   *   resultado = ventas − a reponer − gastos
   * Si no, se usan las ventas anotadas.
   */
  static figures(c: DailyClosing | null | undefined, s: { total: number; cash: number; credit: number }, collected: number, expenses: number) {
    const calc = c ? ClosingsService.calc(c) : null;
    const hasCash = !!c && c.cashCounted !== null && c.cashCounted !== undefined;
    const cashSales = hasCash ? r2(c.cashCounted - (c.cashIncludesCollections ? collected : 0)) : s.cash;
    const sold = hasCash ? r2(cashSales + s.credit + expenses) : s.total;
    const result = calc ? r2(sold - calc.costBs - expenses) : null;
    return { hasCash, cashSales, sold, result, covers: result === null ? null : result >= 0, diffRegistered: hasCash ? r2(sold - s.total) : 0 };
  }

  async day(dateIn?: string) {
    const date = checkDate(dateIn || todayBO());
    const cfg = await this.settings.get();
    const [sales, pays, exp, ships, closing, lastEx] = await Promise.all([
      this.salesSvc.list({ from: date, to: date }),
      this.pays.find({ where: { date }, relations: { sale: { customer: true } } }),
      this.expenses.find({ where: { date } }),
      this.shipments.find({ where: { date } }),
      this.closings.findOne({ where: { date } }),
      this.exchanges.find({ order: { date: 'DESC', id: 'DESC' }, take: 1 }),
    ]);
    const real = sales.filter((s) => !s.legacy);
    const arrivals = ships.flatMap((sh) =>
      sh.items.map((i) => ({ supplierId: sh.supplierId, supplierName: sh.supplier?.name, product: i.product, buckets: i.buckets, kgPerBucket: i.kgPerBucket, pricePerKg: i.pricePerKg })),
    );
    const cmap = new Map<string, number>();
    for (const p of pays) {
      const k = p.sale?.customer?.name || '(sin nombre)';
      cmap.set(k, r2((cmap.get(k) || 0) + p.amount));
    }
    const lastRate = lastEx[0]?.soles > 0 ? Math.round((lastEx[0].bolivianos / lastEx[0].soles) * 10000) / 10000 : cfg.defaultRate;
    if (closing) closing.lines.sort((a, b) => a.id - b.id);
    const tot = { total: sum(real, (s) => s.total), cash: sum(sales, (s) => s.amountPaid), credit: sum(real, (s) => s.total - s.amountPaid) };
    const collectedAmt = sum(pays, (p) => p.amount);
    const expensesAmt = sum(exp, (e) => e.amount);
    return {
      date,
      closing: closing || null,
      fig: ClosingsService.figures(closing, tot, collectedAmt, expensesAmt),
      calc: closing ? ClosingsService.calc(closing) : null,
      arrivals,
      suggestedRate: lastRate,
      sales: {
        count: real.length,
        total: tot.total,
        cash: tot.cash,
        credit: tot.credit,
        arrobas: sum(real, (s) => s.arrobas),
        kgByArrobas: r2(sum(real, (s) => s.arrobas) * cfg.kgPerArroba),
      },
      credits: sales
        .filter((s) => s.total - s.amountPaid > 0.004)
        .map((s) => ({ id: s.id, customer: s.customer?.name, amount: r2(s.total - s.amountPaid), product: s.product, arrobas: s.arrobas, legacy: s.legacy })),
      collections: [...cmap.entries()].map(([customer, amount]) => ({ customer, amount })),
      collected: collectedAmt,
      expenses: expensesAmt,
    };
  }

  /** Reporte día por día (lunes a sábado; el domingo solo si hubo movimiento) */
  async range(fromIn: string, toIn: string) {
    const from = checkDate(fromIn), to = checkDate(toIn);
    if (from > to) throw new BadRequestException('La fecha "desde" debe ser anterior a "hasta"');
    if (diffDays(to, from) > 93) throw new BadRequestException('Elige un rango de máximo 3 meses');
    const w = Between(from, to);
    const [sales, pays, exp, ships, closings] = await Promise.all([
      this.salesSvc.list({ from, to }),
      this.pays.find({ where: { date: w }, relations: { sale: { customer: true } } }),
      this.expenses.find({ where: { date: w } }),
      this.shipments.find({ where: { date: w } }),
      this.closings.find({ where: { date: w } }),
    ]);
    const today = todayBO();
    const days = [];
    for (let d = from; d <= to; d = addDaysISO(d, 1)) {
      const ds = sales.filter((s) => s.date === d);
      const real = ds.filter((s) => !s.legacy);
      const dp = pays.filter((p) => p.date === d);
      const de = exp.filter((e) => e.date === d);
      const dsh = ships.filter((s) => s.date === d);
      const c = closings.find((x) => x.date === d);
      const idle = !ds.length && !dp.length && !de.length && !dsh.length && !c;
      const dow = new Date(d + 'T12:00:00Z').getUTCDay();
      if (dow === 0 && idle) continue;
      if (c) c.lines.sort((a, b) => a.id - b.id);
      const calc = c ? ClosingsService.calc(c) : null;
      const expenses = sum(de, (e) => e.amount);
      const collected = sum(dp, (p) => p.amount);
      const credit0 = sum(real, (s) => s.total - s.amountPaid);
      const fig = ClosingsService.figures(c, { total: sum(real, (s) => s.total), cash: sum(ds, (s) => s.amountPaid), credit: credit0 }, collected, expenses);
      const cmap = new Map<string, number>();
      for (const p of dp) {
        const k = p.sale?.customer?.name || '(sin nombre)';
        cmap.set(k, r2((cmap.get(k) || 0) + p.amount));
      }
      days.push({
        date: d, idle,
        hasClosing: !!c,
        missing: !c && d <= today && (real.length > 0 || dsh.length > 0),
        rate: c?.rate ?? null,
        notes: c?.notes ?? null,
        lines: (c?.lines || []).map((l) => ({ supplierName: l.supplier?.name, product: l.product, bucketsSold: l.bucketsSold, kgPerBucket: l.kgPerBucket, pricePerKg: l.pricePerKg })),
        calc,
        arrivedBuckets: sum(dsh.flatMap((sh) => sh.items), (i) => i.buckets),
        sold: fig.sold, cash: fig.cashSales, credit: credit0, cashCounted: c?.cashCounted ?? null,
        arrobas: sum(real, (s) => s.arrobas),
        collected, expenses, result: fig.result, covers: fig.covers,
        credits: ds.filter((s) => s.total - s.amountPaid > 0.004).map((s) => ({ customer: s.customer?.name, amount: r2(s.total - s.amountPaid), product: s.product, arrobas: s.arrobas, legacy: s.legacy })),
        collections: [...cmap.entries()].map(([customer, amount]) => ({ customer, amount })),
      });
    }
    const closed = days.filter((x) => x.hasClosing);
    return {
      from, to, days,
      totals: {
        sold: sum(days, (x) => x.sold), cash: sum(days, (x) => x.cash), credit: sum(days, (x) => x.credit),
        collected: sum(days, (x) => x.collected), expenses: sum(days, (x) => x.expenses),
        arrobas: sum(days, (x) => x.arrobas),
        buckets: sum(closed, (x) => x.calc.bucketsSold), costBs: sum(closed, (x) => x.calc.costBs),
        result: sum(closed, (x) => x.result),
        missingDays: days.filter((x) => x.missing).length,
      },
    };
  }

  async save(dateIn: string, dto: ClosingDto) {
    const date = checkDate(dateIn);
    let c = await this.closings.findOne({ where: { date } });
    if (c) await this.lines.delete({ closingId: c.id });
    else c = this.closings.create({ date });
    c.rate = dto.rate;
    c.cashCounted = dto.cashCounted ?? null;
    c.cashIncludesCollections = dto.cashIncludesCollections ?? true;
    c.notes = dto.notes;
    c.lines = dto.lines.map((l) => this.lines.create({ ...l }));
    await this.closings.save(c);
    return this.day(date);
  }

  async remove(dateIn: string) {
    await this.closings.delete({ date: checkDate(dateIn) });
    return { ok: true };
  }
}

@Controller('closings')
@UseGuards(JwtAuthGuard)
export class ClosingsController {
  constructor(private s: ClosingsService) {}
  @Get('day') day(@Query('date') date?: string) { return this.s.day(date); }
  @Get('range') range(@Query('from') from: string, @Query('to') to: string) { return this.s.range(from, to); }
  @Put(':date') save(@Param('date') date: string, @Body() dto: ClosingDto) { return this.s.save(date, dto); }
  @Delete(':date') remove(@Param('date') date: string) { return this.s.remove(date); }
}
