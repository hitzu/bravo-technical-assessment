import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { USER_ROLES } from '../../common/types/user-roles.type';
import { USER_STATUS } from '../../common/types/user-status.type';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('users')
@Unique('ux_users_tenant_email', ['tenantId', 'email'])
@Index('ix_users_tenant_role', ['tenantId', 'role'])
export class User extends BaseTimeEntity {
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('varchar', { name: 'email', length: 320 })
  email!: string;

  @Column('varchar', { name: 'full_name', length: 255 })
  fullName!: string;

  @Column({
    type: 'enum',
    enum: USER_ROLES,
    enumName: 'USER_ROLES',
  })
  role!: USER_ROLES;

  @Column({ type: 'jsonb', nullable: true })
  scopes?: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: USER_STATUS,
    enumName: 'USER_STATUS',
    default: USER_STATUS.ACTIVE,
  })
  status!: USER_STATUS;

  @Column('timestamptz', { name: 'last_login_at', nullable: true })
  lastLoginAt?: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}

