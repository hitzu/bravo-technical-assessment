import { ApiProperty } from '@nestjs/swagger';

import { CreditApplicationResponseDto } from './credit-application-response.dto';

export class ListCreditApplicationsResponseDto {
  @ApiProperty({ type: [CreditApplicationResponseDto] })
  data: CreditApplicationResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  constructor(params: {
    data: CreditApplicationResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }) {
    this.data = params.data;
    this.total = params.total;
    this.page = params.page;
    this.pageSize = params.pageSize;
  }
}

