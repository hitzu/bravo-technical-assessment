import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create tenant' })
  @ApiCreatedResponse({ type: TenantResponseDto })
  async create(
    @Body() createTenantDto: CreateTenantDto,
  ): Promise<TenantResponseDto> {
    const tenant = await this.tenantsService.createTenant(createTenantDto);
    return new TenantResponseDto(tenant);
  }

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tenants' })
  @ApiOkResponse({ type: [TenantResponseDto] })
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.tenantsService.findAll();
    return tenants.map((tenant) => new TenantResponseDto(tenant));
  }
}
