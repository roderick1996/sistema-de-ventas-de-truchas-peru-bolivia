import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'viki',
      password: process.env.DB_PASSWORD || 'viki_secret',
      database: process.env.DB_NAME || 'truchas_viki',
      entities: ALL_ENTITIES,
      synchronize: true,
      retryAttempts: 20,
      retryDelay: 3000,
    }),
    AuthModule,
    CoreModule,
  ],
})
export class AppModule {}
