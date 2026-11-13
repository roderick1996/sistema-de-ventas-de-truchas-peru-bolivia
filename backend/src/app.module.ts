import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
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