import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const u = await this.users.findOne({ where: { username: (username || '').trim().toLowerCase() } });
    if (!u || !(await bcrypt.compare(password || '', u.passwordHash))) throw new UnauthorizedException('Usuario o contraseña incorrectos');
    const token = this.jwt.sign({ sub: u.id, username: u.username, name: u.name });
    return { token, user: { id: u.id, username: u.username, name: u.name } };
  }

  async changePassword(id: number, current: string, next: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u || !(await bcrypt.compare(current || '', u.passwordHash))) throw new BadRequestException('La contraseña actual no es correcta');
    if (!next || next.length < 6) throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    u.passwordHash = await bcrypt.hash(next, 10);
    await this.users.save(u);
    return { ok: true };
  }
}
