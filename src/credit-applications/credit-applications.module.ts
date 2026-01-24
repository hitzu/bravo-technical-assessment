import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreditApplicationsController } from './credit-applications.controller';
import { CreditApplication } from './entities/credit-applications.entity';
import { CreditApplicationsService } from './credit-applications.service';

@Module({
  imports: [TypeOrmModule.forFeature([CreditApplication])],
  controllers: [CreditApplicationsController],
  providers: [CreditApplicationsService],
})
export class CreditApplicationsModule { }

