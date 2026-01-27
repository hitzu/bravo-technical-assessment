import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { CREDIT_APPLICATION_STATUS } from '../../common/types/credit-application-status.type';
import { Country } from '../../countries/entities/country.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

const numericToNumberTransformer = {
  to(value: number): number {
    return value;
  },
  from(value: string): number {
    return Number(value);
  },
};

@Entity({ name: 'credit_applications' })
@Index('ix_credit_applications_tenant_status_created_at', [
  'tenantId',
  'status',
  'createdAt',
])
export class CreditApplication extends BaseTimeEntity {
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'created_by' })
  createdBy!: string;

  @Column('uuid', { name: 'country_id' })
  countryId!: string;

  @Column('varchar', { length: 255, name: 'full_name' })
  fullName!: string;

  @Column('varchar', { length: 255, name: 'document_id' })
  documentId!: string;

  @Column('numeric', {
    name: 'monthly_income',
    transformer: numericToNumberTransformer,
  })
  monthlyIncome!: number;

  @Column('numeric', {
    name: 'requested_amount',
    transformer: numericToNumberTransformer,
  })
  requestedAmount!: number;

  @Column({
    type: 'enum',
    enum: CREDIT_APPLICATION_STATUS,
    enumName: 'CREDIT_APPLICATION_STATUS',
    default: CREDIT_APPLICATION_STATUS.PENDING,
  })
  status!: CREDIT_APPLICATION_STATUS;

  @Column('jsonb', { name: 'bank_info', nullable: true })
  bankInfo?: Record<string, unknown> | null;

  @Column('boolean', { name: 'force_risk_failure', default: false })
  forceRiskFailure!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  user!: User;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Country, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id' })
  country!: Country;
}

