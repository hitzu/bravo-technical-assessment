import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { USER_STATUS } from '../common/types/user-status.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.log({ tenantId: dto.tenantId, email: dto.email }, 'Creating user');
    const user = this.usersRepository.create({
      tenantId: dto.tenantId,
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
      status: dto.status ?? USER_STATUS.ACTIVE,
      lastLoginAt: null,
    });
    return this.usersRepository.save(user);
  }

  async findAllUsers(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['tenant'] });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id }, relations: ['tenant'] });
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.getUserById(id);
    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async removeUser(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.softDelete(user.id);
  }
}

