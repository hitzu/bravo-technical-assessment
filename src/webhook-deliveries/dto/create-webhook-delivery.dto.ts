import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWebhookDeliveryDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  applicationId!: string;

  @IsString()
  url!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  headers?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

