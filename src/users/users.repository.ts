import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  create(payload: Partial<User>): User {
    return this.repo.create(payload);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByTenantAndEmail(
    tenantId: string,
    email: string,
  ): Promise<User | null> {
    return this.repo.findOne({ where: { tenantId, email } });
  }

  async softDeleteById(id: string): Promise<boolean> {
    const result = await this.repo.softDelete(id);
    return Boolean(result.affected);
  }
}

