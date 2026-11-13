import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES, Exchange, Expense, SupplierPayment } from '../entities';
import { makeCrud } from './crud';
import { CapitalController, CapitalService } from './capital';
import { ClosingsController, ClosingsService } from './closings';
import { DashboardController, DashboardService } from './dashboard';
import { PurchasingService, ShipmentsController, SuppliersController } from './purchasing';
import { CustomersController, SalesController, SalesService } from './sales';
import { SeedService } from './seed';
import { SettingsController, SettingsService } from './settings';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [
    SalesController, CustomersController, SuppliersController, ShipmentsController, SettingsController, DashboardController, ClosingsController, CapitalController,
    makeCrud('supplier-payments', SupplierPayment, { relations: ['supplier'], order: { date: 'DESC', id: 'DESC' }, hasDate: true }),
    makeCrud('exchanges', Exchange, { order: { date: 'DESC', id: 'DESC' }, hasDate: true }),
    makeCrud('expenses', Expense, { order: { date: 'DESC', id: 'DESC' }, hasDate: true }),
  ],
  providers: [SalesService, PurchasingService, SettingsService, DashboardService, ClosingsService, CapitalService, SeedService],
})
export class CoreModule {}
