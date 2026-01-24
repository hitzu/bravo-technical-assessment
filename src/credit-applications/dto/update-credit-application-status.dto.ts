import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

import { CREDIT_APPLICATION_STATUS } from '../../common/types/credit-application-status.type';

const allowedStatusUpdates: CREDIT_APPLICATION_STATUS[] = [
  CREDIT_APPLICATION_STATUS.IN_REVIEW,
  CREDIT_APPLICATION_STATUS.APPROVED,
  CREDIT_APPLICATION_STATUS.REJECTED,
  CREDIT_APPLICATION_STATUS.ERROR,
];

export class UpdateCreditApplicationStatusDto {
  @ApiProperty({
    description: 'New application status',
    enum: allowedStatusUpdates,
    example: CREDIT_APPLICATION_STATUS.IN_REVIEW,
  })
  @IsNotEmpty()
  @IsIn(allowedStatusUpdates)
  status!: CREDIT_APPLICATION_STATUS;
}

