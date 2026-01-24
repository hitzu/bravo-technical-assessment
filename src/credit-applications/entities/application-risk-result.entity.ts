import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Country } from '../../countries/entities/country.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import { CreditApplication } from './credit-applications.entity';

const numericToNumberTransformer = {
  to(value: number): number {
    return value;
  },
  from(value: string): number {
    return Number(value);
  },
};

@Entity({ name: 'application_risk_results' })
@Index('ix_application_risk_results_tenant_application', [
  'tenantId',
  'applicationId',
])
export class ApplicationRiskResult extends BaseTimeEntity {
  @Column('uuid', { name: 'application_id' })
  applicationId!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'country_id' })
  countryId!: string;

  @Column('numeric', {
    name: 'debt_to_income_ratio',
    transformer: numericToNumberTransformer,
  })
  debtToIncomeRatio!: number;

  @Column('int', { name: 'risk_score' })
  riskScore!: number;

  @Column({
    type: 'enum',
    enum: APPLICATION_RISK_DECISION,
    enumName: 'APPLICATION_RISK_DECISION',
  })
  decision!: APPLICATION_RISK_DECISION;

  @Column('jsonb', { name: 'raw_bank_snapshot' })
  rawBankSnapshot!: Record<string, unknown>;

  @ManyToOne(() => CreditApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application!: CreditApplication;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Country, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id' })
  country!: Country;
}

