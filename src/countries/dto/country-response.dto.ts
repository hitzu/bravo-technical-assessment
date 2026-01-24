import { ApiProperty } from '@nestjs/swagger';
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

  constructor(country: Country) {
    this.id = country.id;
    this.code = country.code;
    this.name = country.name;
  }
}

