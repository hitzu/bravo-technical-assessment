import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCreditApplicationDto {
  @ApiProperty({
    description: 'Country identifier (UUID)',
    example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
  })
  @IsNotEmpty()
  @IsUUID()
  countryId!: string;

  @ApiProperty({
    description: 'Applicant full name',
    example: 'Juan Pérez',
  })
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @ApiProperty({
    description: 'Applicant document identifier',
    example: 'XEXX010101000',
  })
  @IsNotEmpty()
  @IsString()
  documentId!: string;

  @ApiProperty({
    description: 'Applicant monthly income',
    example: 25000,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  monthlyIncome!: number;

  @ApiProperty({
    description: 'Requested credit amount',
    example: 100000,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  requestedAmount!: number;
}

