import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getTypeOrmConfig } from './config/database';
import { LoggerModule } from 'nestjs-pino';
import { getLoggerConfigs } from './config/logger/logger.config';
import { DevTokenGuard } from './auth/guards/dev-token.guard';
import { AuthModule } from './auth/auth.module';
import { TokenModule } from './tokens/token.module';
import { TenantsModule } from './tenants/tenants.module';
import { CreditApplicationsModule } from './credit-applications/credit-applications.module';
import { CountriesModule } from './countries/countries.module';
import { AsyncJobsModule } from './async-jobs/async-jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'local'}`,
        '.env.test',
        '.env',
      ],
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot(getLoggerConfigs()),
    TypeOrmModule.forRootAsync({
      useFactory: () => getTypeOrmConfig(),
    }),
    AuthModule,
    TokenModule,
    TenantsModule,
    CreditApplicationsModule,
    CountriesModule,
    AsyncJobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: DevTokenGuard,
    },
  ],
})
export class AppModule { }
