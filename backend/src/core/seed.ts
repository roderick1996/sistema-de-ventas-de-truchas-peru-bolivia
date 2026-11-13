import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Setting, Supplier, User } from '../entities';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(@InjectRepository(User) private users: Repository<User>, @InjectRepository(Supplier) private suppliers: Repository<Supplier>, @InjectRepository(Setting) private settings: Repository<Setting>) {}
  async onModuleInit() {
    const pass = process.env.SEED_PASSWORD || 'viki2026';
    const seed = [
      { username: 'rodrigo', name: 'Rodrigo Blanco Huanca' },
      { username: 'gabriela', name: 'Gabriela Aliaga Huanca' },
    ];
    for (const u of seed) {
      if (!(await this.users.findOne({ where: { username: u.username } }))) {
        await this.users.save({ ...u, passwordHash: await bcrypt.hash(pass, 10) });
      }
    }
    if (!(await this.settings.findOne({ where: { key: 'seed_suppliers_v2' } }))) {
      for (const name of ['Nubeluz', 'Sonia', 'Basilio', 'Roberto']) {
        if (!(await this.suppliers.findOne({ where: { name } }))) await this.suppliers.save({ name, openingDebt: 0 });
      }
      await this.settings.save({ key: 'seed_suppliers_v2', value: '1' });
    }
  }
}
