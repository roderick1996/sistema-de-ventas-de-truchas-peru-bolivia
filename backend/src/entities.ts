import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

const numTx = { to: (v: any) => v, from: (v: any) => (v === null || v === undefined ? v : parseFloat(v)) };
const money = (precision = 12, scale = 2) => ({ type: 'numeric' as const, precision, scale, default: 0, transformer: numTx });
export type Product = 'NORMAL' | 'RETACO';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) username: string;
  @Column() name: string;
  @Column() passwordHash: string;
}

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ nullable: true }) notes?: string;
  /** Deuda en soles que ya existía antes de usar el sistema */
  @Column(money(12, 2)) openingDebt: number;
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column() supplierId: number;
  @ManyToOne(() => Supplier, { eager: true }) @JoinColumn({ name: 'supplierId' }) supplier: Supplier;
  @Column({ nullable: true }) notes?: string;
  @OneToMany(() => ShipmentItem, (i) => i.shipment, { cascade: true, eager: true }) items: ShipmentItem[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('shipment_items')
export class ShipmentItem {
  @PrimaryGeneratedColumn() id: number;
  @Column() shipmentId: number;
  @ManyToOne(() => Shipment, (s) => s.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'shipmentId' }) shipment: Shipment;
  @Column({ type: 'varchar' }) product: Product;
  @Column(money(10, 2)) buckets: number;
  @Column(money(8, 2)) kgPerBucket: number;
  /** Precio en soles por KILO */
  @Column(money(10, 2)) pricePerKg: number;
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ nullable: true }) notes?: string;
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column({ nullable: true }) customerId?: number;
  @ManyToOne(() => Customer, { nullable: true }) @JoinColumn({ name: 'customerId' }) customer?: Customer;
  @Column({ type: 'varchar' }) product: Product;
  @Column(money(10, 2)) arrobas: number;
  @Column(money(10, 2)) pricePerArroba: number;
  @Column(money()) total: number;
  /** Lo que pagó en el momento de la venta */
  @Column(money()) amountPaid: number;
  /** Monto dado por perdido (incobrable) */
  @Column(money()) writtenOffAmount: number;
  /** Deuda anterior al sistema: no cuenta como venta ni utilidad */
  @Column({ default: false }) legacy: boolean;
  @Column({ nullable: true }) notes?: string;
  @Column({ nullable: true }) createdBy?: string;
  @OneToMany(() => Payment, (p) => p.sale) payments: Payment[];
  @CreateDateColumn() createdAt: Date;
}

/** Cobro posterior de una deuda ("recogido") */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn() id: number;
  @Column() saleId: number;
  @ManyToOne(() => Sale, (s) => s.payments, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'saleId' }) sale: Sale;
  @Column({ type: 'date' }) date: string;
  @Column(money()) amount: number;
  @Column({ nullable: true }) notes?: string;
}

@Entity('supplier_payments')
export class SupplierPayment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column() supplierId: number;
  @ManyToOne(() => Supplier, { eager: true }) @JoinColumn({ name: 'supplierId' }) supplier: Supplier;
  @Column(money()) soles: number;
  @Column({ nullable: true }) notes?: string;
}

@Entity('exchanges')
export class Exchange {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column(money()) bolivianos: number;
  @Column(money()) soles: number;
  @Column({ nullable: true }) notes?: string;
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column() description: string;
  @Column(money()) amount: number;
}

/** Cuadre del día: cubetas vendidas, kilos y costo en soles/bolivianos */
@Entity('daily_closings')
export class DailyClosing {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date', unique: true }) date: string;
  /** Bolivianos por 1 sol, el del día */
  @Column(money(10, 4)) rate: number;
  /** Efectivo contado en caja al final del día (opcional) */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numTx }) cashCounted?: number;
  /** El efectivo contado incluye lo que pagaron de deudas antiguas */
  @Column({ default: true }) cashIncludesCollections: boolean;
  @Column({ nullable: true }) notes?: string;
  @OneToMany(() => DailyClosingLine, (l) => l.closing, { cascade: true, eager: true }) lines: DailyClosingLine[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('daily_closing_lines')
export class DailyClosingLine {
  @PrimaryGeneratedColumn() id: number;
  @Column() closingId: number;
  @ManyToOne(() => DailyClosing, (c) => c.lines, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'closingId' }) closing: DailyClosing;
  @Column() supplierId: number;
  @ManyToOne(() => Supplier, { eager: true }) @JoinColumn({ name: 'supplierId' }) supplier: Supplier;
  @Column({ type: 'varchar' }) product: Product;
  @Column(money(10, 2)) bucketsSold: number;
  @Column(money(8, 2)) kgPerBucket: number;
  @Column(money(10, 2)) pricePerKg: number;
}

/** Movimientos manuales del capital (lo recogido de deudas entra solo) */
@Entity('capital_movements')
export class CapitalMovement {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'varchar' }) type: 'IN' | 'OUT';
  @Column(money()) amount: number;
  @Column({ nullable: true }) description?: string;
}

@Entity('settings')
export class Setting {
  @PrimaryColumn() key: string;
  @Column() value: string;
}

export const ALL_ENTITIES = [User, Supplier, Shipment, ShipmentItem, Customer, Sale, Payment, SupplierPayment, Exchange, Expense, DailyClosing, DailyClosingLine, CapitalMovement, Setting];
