import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
