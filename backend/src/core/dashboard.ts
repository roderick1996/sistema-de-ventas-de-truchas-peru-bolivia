import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyClosing, Exchange, Expense, Payment, Sale, Shipment, ShipmentItem, SupplierPayment } from '../entities';
import { diffDays, r2, todayBO, weekRange } from '../util';
import { CapitalService } from './capital';
import { PurchasingService } from './purchasing';
import { SalesService } from './sales';
import { SettingsService } from './settings';

const sum = (a: any[], f: (x: any) => number) => r2(a.reduce((t, x) => t + f(x), 0));

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale) private sales: Repository<Sale>,
    @InjectRepository(Payment) private pays: Repository<Payment>,
    @InjectRepository(Expense) private expenses: Repository<Expense>,
    @InjectRepository(Exchange) private exchanges: Repository<Exchange>,
    @InjectRepository(SupplierPayment) private sp: Repository<SupplierPayment>,
    @InjectRepository(Shipment) private shipments: Repository<Shipment>,
    @InjectRepository(DailyClosing) private closings: Repository<DailyClosing>,
    @InjectRepository(ShipmentItem) private items: Repository<ShipmentItem>,
    private salesSvc: SalesService,
    private settings: SettingsService,
    private purchasing: PurchasingService,
    private capital: CapitalService,
  ) {}

  /** Tipo de cambio promedio (Bs por sol) y costo promedio por kilo en Bs de cada tipo de trucha */
  async costs() {
    const cfg = await this.settings.get();
    const [items, ex] = await Promise.all([this.items.find(), this.exchanges.find()]);
    const bs = sum(ex, (e) => e.bolivianos), soles = sum(ex, (e) => e.soles);
    const rate = soles > 0 ? bs / soles : cfg.defaultRate;
    const per: any = { NORMAL: { soles: 0, kg: 0 }, RETACO: { soles: 0, kg: 0 } };
    for (const i of items) {
      per[i.product].soles += i.buckets * i.kgPerBucket * i.pricePerKg;
      per[i.product].kg += i.buckets * i.kgPerBucket;
    }
    const costPerKg = {
      NORMAL: per.NORMAL.kg > 0 ? (per.NORMAL.soles / per.NORMAL.kg) * rate : 0,
      RETACO: per.RETACO.kg > 0 ? (per.RETACO.soles / per.RETACO.kg) * rate : 0,
    };
    return { rate: Math.round(rate * 10000) / 10000, costPerKg, cfg };
  }

  async period(from: string, to: string) {
    const costs = await this.costs();
    const w = { date: Between(from, to) };
    const [sales, pays, exp, exch, spay, ship] = await Promise.all([
      this.sales.find({ where: w }), this.pays.find({ where: w }), this.expenses.find({ where: w }),
      this.exchanges.find({ where: w }), this.sp.find({ where: w }), this.shipments.find({ where: w }),
    ]);
    const real = sales.filter((s) => !s.legacy);
    // Costo: si el día tiene cuadre (cubetas vendidas) se usa ese costo real; si no, un costo promedio estimado
    const closings = await this.closings.find({ where: w });
    // Si el día tiene efectivo contado, las ventas del día salen de: efectivo − cobros antiguos + fiado + gastos
    let revenue = sum(real, (s) => s.total);
    for (const c of closings) {
      if (c.cashCounted === null || c.cashCounted === undefined) continue;
      const rd = real.filter((s) => s.date === c.date);
      const coll = sum(pays.filter((p) => p.date === c.date), (p) => p.amount);
      const g = sum(exp.filter((e) => e.date === c.date), (e) => e.amount);
      revenue = r2(revenue - sum(rd, (s) => s.total) + (c.cashCounted - (c.cashIncludesCollections ? coll : 0)) + sum(rd, (s) => s.total - s.amountPaid) + g);
    }
    const closedDates = new Set(closings.map((c) => c.date));
    const closedCost = sum(closings, (c) => c.rate * c.lines.reduce((t, l) => t + l.bucketsSold * l.kgPerBucket * l.pricePerKg, 0));
    const kgSold = { NORMAL: 0, RETACO: 0 };
    const kgEst = { NORMAL: 0, RETACO: 0 };
    for (const s of real) {
      const kg = s.arrobas * costs.cfg.kgPerArroba;
      kgSold[s.product] += kg;
      if (!closedDates.has(s.date)) kgEst[s.product] += kg;
    }
    const estimatedDays = new Set(real.filter((s) => !closedDates.has(s.date)).map((s) => s.date)).size;
    const cogs = r2(closedCost + kgEst.NORMAL * costs.costPerKg.NORMAL + kgEst.RETACO * costs.costPerKg.RETACO);
    const badDebt = sum(real, (s) => s.writtenOffAmount);
    const expenses = sum(exp, (e) => e.amount);
    const cashSales = sum(sales, (s) => s.amountPaid);
    const collected = sum(pays, (p) => p.amount);
    const exBs = sum(exch, (e) => e.bolivianos), exSoles = sum(exch, (e) => e.soles);
    return {
      from, to, revenue, cashSales, collected, cashIn: r2(cashSales + collected),
      creditGiven: sum(real, (s) => s.total - s.amountPaid),
      badDebt, expenses, cogs, closedDays: closings.length, estimatedDays,
      profit: r2(revenue - badDebt - cogs - expenses),
      arrobas: sum(real, (s) => s.arrobas),
      kgSold,
      exchange: { bolivianos: exBs, soles: exSoles, rate: exSoles > 0 ? Math.round((exBs / exSoles) * 10000) / 10000 : 0 },
      purchasedSoles: sum(ship, (sh) => sh.items.reduce((t, i) => t + i.buckets * i.kgPerBucket * i.pricePerKg, 0)),
      supplierPaidSoles: sum(spay, (p) => p.soles),
    };
  }

  /** Caja y posición acumulada */
  async position() {
    const cfg = await this.settings.get();
    const n = async (p: Promise<number>) => Number((await p) || 0);
    const [sales, pays, exp, exBs, exSoles, spaid] = await Promise.all([
      n(this.sales.sum('amountPaid')), n(this.pays.sum('amount')), n(this.expenses.sum('amount')),
      n(this.exchanges.sum('bolivianos')), n(this.exchanges.sum('soles')), n(this.sp.sum('soles')),
    ]);
    const open = await this.salesSvc.openSales();
    const capitalBal = (await this.capital.balance()).balance;
    return {
      cashBs: capitalBal,
      cashSoles: r2(cfg.openingCashSoles + exSoles - spaid),
      customersDebt: sum(open, (s) => s.balance),
      capital: capitalBal,
    };
  }

  async report(from?: string, to?: string) {
    const w = weekRange(todayBO());
    from = from || w.from; to = to || w.to;
    const [period, position, suppliers, costs] = await Promise.all([this.period(from, to), this.position(), this.purchasing.balances(), this.costs()]);
    const supplierDebtSoles = sum(suppliers, (s) => s.debt);
    const supplierDebtBs = r2(supplierDebtSoles * costs.rate);
    return {
      period, position, suppliers, rate: costs.rate, costPerKg: costs.costPerKg,
      supplierDebtSoles, supplierDebtBs,
      netWorthBs: r2(position.cashBs + position.customersDebt + position.cashSoles * costs.rate - supplierDebtBs),
    };
  }

  async summary() {
    const today = todayBO();
    const cfg = await this.settings.get();
    const open = await this.salesSvc.openSales();
    const groups = new Map<number, any>();
    for (const s of open) {
      let g = groups.get(s.customerId);
      if (!g) {
        g = { customerId: s.customerId, name: s.customer?.name || '(sin nombre)', phone: s.customer?.phone, balance: 0, oldestDate: s.date, sales: [] };
        groups.set(s.customerId, g);
      }
      g.balance = r2(g.balance + s.balance);
      if (s.date < g.oldestDate) g.oldestDate = s.date;
      g.sales.push({ id: s.id, date: s.date, product: s.product, arrobas: s.arrobas, balance: s.balance });
    }
    const debtors = [...groups.values()].map((g) => {
      const daysOpen = Math.max(0, diffDays(today, g.oldestDate));
      return { ...g, daysOpen, overdue: daysOpen >= cfg.debtAlertDays };
    }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.daysOpen - a.daysOpen || b.balance - a.balance);

    const todaySales = await this.salesSvc.list({ from: today, to: today });
    const creditsToday = todaySales
      .filter((s) => s.total - s.amountPaid > 0.004)
      .map((s) => ({ id: s.id, customer: s.customer?.name, amount: r2(s.total - s.amountPaid), product: s.product, arrobas: s.arrobas, legacy: s.legacy }));
    const payToday = await this.pays.find({ where: { date: today }, relations: { sale: { customer: true } } });
    const cmap = new Map<string, number>();
    for (const p of payToday) {
      const k = p.sale?.customer?.name || '(sin nombre)';
      cmap.set(k, r2((cmap.get(k) || 0) + p.amount));
    }
    const collectedToday = [...cmap.entries()].map(([customer, amount]) => ({ customer, amount }));

    const w = weekRange(today);
    const [week, position, suppliers] = await Promise.all([this.period(w.from, w.to), this.position(), this.purchasing.balances()]);
    const todayReal = todaySales.filter((s) => !s.legacy);
    return {
      today, alertDays: cfg.debtAlertDays,
      debtors,
      totalDebt: sum(debtors, (d) => d.balance),
      overdueCount: debtors.filter((d) => d.overdue).length,
      overdueAmount: sum(debtors.filter((d) => d.overdue), (d) => d.balance),
      todaySalesTotal: sum(todayReal, (s) => s.total),
      todayArrobas: sum(todayReal, (s) => s.arrobas),
      creditsToday, creditsTodayTotal: sum(creditsToday, (c) => c.amount),
      collectedToday, collectedTodayTotal: sum(collectedToday, (c) => c.amount),
      position, week,
      supplierDebtSoles: sum(suppliers, (s) => s.debt),
    };
  }
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private d: DashboardService) {}
  @Get() summary() { return this.d.summary(); }
  @Get('report') report(@Query('from') from?: string, @Query('to') to?: string) { return this.d.report(from, to); }
}
