import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto { @IsString() username: string; @IsString() password: string; }
class PasswordDto { @IsString() current: string; @IsString() next: string; }

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login') login(@Body() d: LoginDto) { return this.auth.login(d.username, d.password); }
  @UseGuards(JwtAuthGuard) @Get('me') me(@Req() req: any) { return req.user; }
  @UseGuards(JwtAuthGuard) @Post('password') pw(@Req() req: any, @Body() d: PasswordDto) {
    return this.auth.changePassword(req.user.id, d.current, d.next);
  }
}
