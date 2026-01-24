import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CountriesService } from './countries.service';
import { CountryResponseDto } from './dto/country-response.dto';

@ApiTags('countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) { }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active countries' })
  @ApiOkResponse({ type: [CountryResponseDto] })
  async listActive(): Promise<CountryResponseDto[]> {
    const countries = await this.countriesService.findAllActive();
    return countries.map((c) => new CountryResponseDto(c));
  }

  @Get(':code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get country by code' })
  @ApiOkResponse({ type: CountryResponseDto })
  @ApiNotFoundResponse({ description: 'Country not found' })
  async getByCode(
    @Param('code') code: string,
  ): Promise<CountryResponseDto> {
    const country = await this.countriesService.findByCode(code);
    if (!country) {
      throw new NotFoundException('Country not found');
    }
    return new CountryResponseDto(country);
  }
}

