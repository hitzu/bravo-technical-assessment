import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TOKEN_TYPE } from '../common/types/token-type';
import { Token } from './entities/token.entity';
import type { User } from '../users/entities/user.entity';

interface RegisterTokenParams {
  token: string;
  type: TOKEN_TYPE;
  userId?: string | null;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
  ) { }

  async registerToken(params: RegisterTokenParams): Promise<Token> {
    const { token, type, userId } = params;

    const tokenEntity = this.tokenRepository.create({
      token,
      type,
      user: userId ? ({ id: userId } as User) : null,
    });

    const savedToken = await this.tokenRepository.save(tokenEntity);
    this.logger.debug(
      { tokenId: savedToken.id, userId },
      'Token registered in store',
    );

    return savedToken;
  }

  async findActiveToken(rawToken: string): Promise<Token | null> {
    return this.tokenRepository.findOne({
      where: { token: rawToken },
      relations: { user: true },
      withDeleted: false,
    });
  }

  async revokeToken(rawToken: string): Promise<boolean> {
    const result = await this.tokenRepository.softDelete({ token: rawToken });
    const revoked = (result.affected ?? 0) > 0;
    this.logger.debug({ revoked }, 'Token revoked');
    return revoked;
  }
}
