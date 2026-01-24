import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { DevLoginResponseDto } from './dto/dev-login-response.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // Dev-only signup helper to quickly seed operators in testing environments.
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dev signup for testing (NOT production ready)' })
  @ApiCreatedResponse({
    description: 'Operator created with a dev token',
    type: DevLoginResponseDto,
  })
  async signup(
    @Body() createUserDto: CreateUserDto,
  ): Promise<DevLoginResponseDto> {
    return this.authService.signup(createUserDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dev login for testing (NOT real auth)' })
  @ApiOkResponse({
    description: 'Returns a dev token and operator info',
    type: DevLoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request',
  })
  @ApiNotFoundResponse({
    description: 'Operator not found or no operators available',
  })
  async login(@Body() loginDto: LoginDto): Promise<DevLoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke current token (dev logout)' })
  @ApiNoContentResponse({ description: 'Token revoked' })
  @ApiUnauthorizedResponse({ description: 'Bearer token required' })
  async logout(
    @Headers('authorization') rawToken: string,
  ): Promise<void> {
    await this.authService.logout(rawToken);
  }
}
