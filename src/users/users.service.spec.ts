import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { USER_ROLES } from '../common/types/user-roles.type';
import { USER_STATUS } from '../common/types/user-status.type';
import { UserFactory } from '@factories/user/user.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: Repository<User>;
  let userFactory: UserFactory;
  let tenantFactory: TenantFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: TestDataSource.getRepository(User),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    userFactory = new UserFactory(TestDataSource);
    tenantFactory = new TenantFactory(TestDataSource);
  });

  describe('createUser', () => {
    it('creates user and defaults status to ACTIVE and lastLoginAt to null', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const userAttrs = await userFactory.make({ role: USER_ROLES.AGENT, tenant });
      const dto = {
        tenantId: tenant.id,
        email: userAttrs.email,
        fullName: userAttrs.fullName,
        role: userAttrs.role,
      };

      // Act
      const user = await service.createUser(dto);
      const persisted = await userRepo.findOne({ where: { id: user.id } });

      // Assert
      expect(user.id).toBeDefined();
      expect(user.tenantId).toBe(dto.tenantId);
      expect(user.email).toBe(dto.email);
      expect(user.fullName).toBe(dto.fullName);
      expect(user.role).toBe(dto.role);
      expect(user.status).toBe(USER_STATUS.ACTIVE);
      expect(user.lastLoginAt).toBeNull();
      expect(persisted).not.toBeNull();
    });

    it('respects explicit status when provided', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const userAttrs = await userFactory.make({
        tenant,
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.SUSPENDED,
      });
      const dto = {
        tenantId: tenant.id,
        email: userAttrs.email,
        fullName: userAttrs.fullName,
        role: userAttrs.role,
        status: userAttrs.status,
      };

      // Act
      const user = await service.createUser(dto);

      // Assert
      expect(user.status).toBe(USER_STATUS.SUSPENDED);
    });
  });

  describe('findAllUsers', () => {
    it('returns empty array when no users exist', async () => {
      // Act
      const users = await service.findAllUsers();

      // Assert
      expect(users).toEqual([]);
    });

    it('lists existing users', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const userA = await userFactory.create({ tenant });
      const userB = await userFactory.create({ tenant });

      // Act
      const users = await service.findAllUsers();

      // Assert
      expect(users.map((u) => u.id)).toEqual(
        expect.arrayContaining([userA.id, userB.id]),
      );
    });
  });

  describe('findUserById / getUserById', () => {
    it('findUserById returns null when missing', async () => {
      // Act
      const user = await service.findUserById('00000000-0000-0000-0000-000000000000');

      // Assert
      expect(user).toBeNull();
    });

    it('getUserById throws NotFoundException when missing', async () => {
      // Act / Assert
      await expect(service.getUserById('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('updates allowed fields', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const user = await userFactory.create({
        tenant,
        email: 'old@bravocredit.com',
        fullName: 'Old Name',
        status: USER_STATUS.ACTIVE,
      });

      // Act
      const updated = await service.updateUser(user.id, {
        email: 'new@school.edu',
        fullName: 'New Name',
        status: USER_STATUS.SUSPENDED,
      });
      const persisted = await userRepo.findOne({ where: { id: user.id } });

      // Assert
      expect(updated.email).toBe('new@school.edu');
      expect(updated.fullName).toBe('New Name');
      expect(updated.status).toBe(USER_STATUS.SUSPENDED);
      expect(persisted?.email).toBe('new@school.edu');
    });
  });

  describe('removeUser', () => {
    it('soft-deletes existing user', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const user = await userFactory.create({ tenant });

      // Act
      await service.removeUser(user.id);
      const found = await userRepo.findOne({ where: { id: user.id } });

      // Assert
      expect(found).toBeNull();
    });

    it('throws NotFoundException when user is missing', async () => {
      // Act / Assert
      await expect(service.removeUser('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

