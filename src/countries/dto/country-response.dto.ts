import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type { Country } from '../entities/country.entity';

export class CountryResponseDto {
  @Expose()
  @ApiProperty({ description: 'Country identifier (UUID)', example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'ES', description: '2-char ISO country code' })
  code: string;

  @Expose()
  @ApiProperty({ example: 'España', description: 'Country name' })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    example: 'DNI/NIF',
    description: 'Human-readable document label for this country (simplified)',
    nullable: true,
  })
  documentLabel: string | null;

  @Expose()
  @ApiPropertyOptional({
    example: '^[0-9]{7,8}[A-Z]$',
    description:
      'Country-specific document regex pattern (simplified; used by backend validation).',
    nullable: true,
  })
  documentRegexPattern: string | null;

  @Expose()
  @ApiPropertyOptional({
    example: '01234567A',
    description: 'Example of a valid document for this country',
    nullable: true,
  })
  documentExample: string | null;

  constructor(country: Country) {
    this.id = country.id;
    this.code = country.code;
    this.name = country.name;
    this.documentLabel = country.documentLabel;
    this.documentRegexPattern = country.documentRegexPattern;
    this.documentExample = country.documentExample;
  }
}

