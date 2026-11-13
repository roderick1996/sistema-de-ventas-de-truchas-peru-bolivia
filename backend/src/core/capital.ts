import { Body, Controller, Delete, Get, Injectable, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapitalMovement, DailyClosing, Exchange, Expense, Payment, Sale } from '../entities';
import { addDaysISO, r2, todayBO } from '../util';
import { SettingsService } from './settings';

export class MovementDto {
  @IsDateString() date: string;
  @IsIn(['IN', 'OUT']) type: 'IN' | 'OUT';
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() description?: string;
}

interface Entry { key: string; id: number | null; date: string; kind: string; who: string; amount: number; notes?: string }

/**
 * CAPITAL = el dinero real en bolivianos. Se arma solo:
 *   + efectivo de las ventas de cada día (el efectivo contado en el cuadre; si no hay cuadre, las ventas al contado anotadas)
 *   + deudas recogidas (dinero físico)
 *   + capital agregado a mano
 *   − cambios de bolivianos a soles
 *   − gastos (los del día con efectivo contado ya vienen descontados en ese efectivo)
 *   − capital usado a mano
 * Lo recogido NO suma a las ventas del cuadre, pero sí al capital.
 */
@Injectable()
export class CapitalService {
  constructor(
    @InjectRepository(Payment) private pays: Repository<Payment>,
    @InjectRepository(CapitalMovement) private mov: Repository<CapitalMovement>,
    @InjectRepository(Sale) private sales: Repository<Sale>,
    @InjectRepository(Expense) private expenses: Repository<Expense>,
    @InjectRepository(Exchange) private exchanges: Repository<Exchange>,
    @InjectRepository(DailyClosing) private closings: Repository<DailyClosing>,
    private settings: SettingsService,
  ) {}

  private async ledger() {
    const [pays, movs, sales, exp, exch, closings, cfg] = await Promise.all([
      this.pays.find({ relations: { sale: { customer: true } } }),
      this.mov.find(), this.sales.find(), this.expenses.find(), this.exchanges.find(), this.closings.find(), this.settings.get(),
    ]);
    const closingBy = new Map(closings.map((c) => [c.date, c]));
    const counted = (d: string) => {
      const c = closingBy.get(d);
      return c && c.cashCounted !== null && c.cashCounted !== undefined ? c : null;
    };
    const collBy = new Map<string, number>();
    for (const p of pays) collBy.set(p.date, (collBy.get(p.date) || 0) + p.amount);
    const cashBy = new Map<string, number>();
    for (const s of sales) cashBy.set(s.date, (cashBy.get(s.date) || 0) + s.amountPaid);

    const E: Entry[] = [];
    const dates = new Set<string>([...cashBy.keys(), ...closings.filter((c) => counted(c.date)).map((c) => c.date)]);
    for (const d of dates) {
      const c = counted(d);
      if (c) {
        E.push({ key: 'v' + d, id: null, date: d, kind: 'VENTAS', who: 'Efectivo contado en el cuadre del día', amount: r2(c.cashCounted - (c.cashIncludesCollections ? collBy.get(d) || 0 : 0)) });
      } else if (Math.abs(cashBy.get(d) || 0) > 0.004) {
        E.push({ key: 'v' + d, id: null, date: d, kind: 'VENTAS', who: 'Ventas al contado anotadas (sin cuadre)', amount: r2(cashBy.get(d)) });
      }
    }
    for (const p of pays) E.push({ key: 'p' + p.id, id: null, date: p.date, kind: 'RECOGIDO', who: p.sale?.customer?.name || '(sin nombre)', amount: p.amount });
    for (const e of exp) if (!counted(e.date)) E.push({ key: 'g' + e.id, id: null, date: e.date, kind: 'GASTO', who: e.description, amount: -e.amount });
    for (const x of exch) E.push({ key: 'c' + x.id, id: null, date: x.date, kind: 'CAMBIO', who: `Cambio a soles (S/ ${x.soles})`, amount: -x.bolivianos });
    for (const m of movs) E.push({ key: 'm' + m.id, id: m.id, date: m.date, kind: m.type === 'IN' ? 'ENTRADA' : 'SALIDA', who: m.description || '', amount: m.type === 'IN' ? m.amount : -m.amount });
    E.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { entries: E, opening: cfg.openingCashBs };
  }

  private totals(entries: Entry[], opening: number) {
    const t = (k: string) => r2(entries.filter((e) => e.kind === k).reduce((a, e) => a + e.amount, 0));
    const salesCash = t('VENTAS'), collected = t('RECOGIDO'), expenses = t('GASTO'), exchanged = t('CAMBIO'), manualIn = t('ENTRADA'), manualOut = -t('SALIDA');
    return { opening, salesCash, collected, expenses, exchanged, manualIn, manualOut, balance: r2(opening + salesCash + collected + expenses + exchanged + manualIn - manualOut) };
  }

  async balance() {
    const { entries, opening } = await this.ledger();
    return this.totals(entries, opening);
  }

  async list(fromIn?: string, toIn?: string) {
    const to = toIn || todayBO();
    const from = fromIn || addDaysISO(to, -30);
    const { entries, opening } = await this.ledger();
    const inRange = entries.filter((e) => e.date >= from && e.date <= to);
    return { from, to, ...this.totals(entries, opening), entries: inRange, periodTotal: r2(inRange.reduce((t, e) => t + e.amount, 0)) };
  }
}

@Controller('capital')
@UseGuards(JwtAuthGuard)
export class CapitalController {
  constructor(private s: CapitalService, @InjectRepository(CapitalMovement) private mov: Repository<CapitalMovement>) {}
  @Get() list(@Query('from') from?: string, @Query('to') to?: string) { return this.s.list(from, to); }
  @Post('movements') create(@Body() d: MovementDto) { return this.mov.save(this.mov.create(d)); }
  @Delete('movements/:id') async remove(@Param('id', ParseIntPipe) id: number) { await this.mov.delete(id); return { ok: true }; }
}
