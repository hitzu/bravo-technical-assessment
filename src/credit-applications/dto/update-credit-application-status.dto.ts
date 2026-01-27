import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

import { CREDIT_APPLICATION_STATUS } from '../../common/types/credit-application-status.type';

const allowedStatusUpdates: CREDIT_APPLICATION_STATUS[] = [
  CREDIT_APPLICATION_STATUS.APPROVED,
  CREDIT_APPLICATION_STATUS.REJECTED,
];

export class UpdateCreditApplicationStatusDto {
  @ApiProperty({
    description: 'New application status (manual admin update)',
    enum: allowedStatusUpdates,
    example: CREDIT_APPLICATION_STATUS.APPROVED,
  })
  @IsNotEmpty()
  @IsIn(allowedStatusUpdates, {
    message: 'New status must be APPROVED or REJECTED for manual admin update',
  })
  status!: CREDIT_APPLICATION_STATUS;
}

