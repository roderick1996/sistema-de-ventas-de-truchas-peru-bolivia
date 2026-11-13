import { Body, Controller, Get, Injectable, Put, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Setting } from '../entities';

export const DEFAULTS: Record<string, number> = {
  kgPerArroba: 11.5,
  kgPerBucket: 35,
  debtAlertDays: 7,
  defaultRate: 3.5,
  priceNormal: 0,
  priceRetaco: 0,
  openingCashBs: 0,
  openingCashSoles: 0,
};

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private repo: Repository<Setting>) {}
  async get() {
    const out: Record<string, number> = { ...DEFAULTS };
    for (const r of await this.repo.find()) if (r.key in DEFAULTS) out[r.key] = parseFloat(r.value);
    return out;
  }
  async set(body: any) {
    for (const k of Object.keys(DEFAULTS)) {
      if (body?.[k] !== undefined && body[k] !== '' && !isNaN(Number(body[k]))) await this.repo.save({ key: k, value: String(Number(body[k])) });
    }
    return this.get();
  }
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private s: SettingsService) {}
  @Get() get() { return this.s.get(); }
  @Put() put(@Body() b: any) { return this.s.set(b); }
}
