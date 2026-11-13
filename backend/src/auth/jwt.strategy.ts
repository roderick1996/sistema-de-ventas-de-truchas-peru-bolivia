import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
export const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: JWT_SECRET() });
  }
  validate(p: any) {
    return { id: p.sub, username: p.username, name: p.name };
  }
}
