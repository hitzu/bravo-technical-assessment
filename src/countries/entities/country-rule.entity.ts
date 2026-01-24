import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Country } from './country.entity';

const numericToNumberTransformer = {
  to(value: number | null): number | null {
    return value;
  },
  from(value: string | null): number | null {
    if (value === null) return null;
    return Number(value);
  },
};

@Entity({ name: 'country_rules' })
@Index('ix_country_rules_country_active', ['countryId', 'isActive'])
@Unique('ux_country_rules_country_version', ['countryId', 'version'])
export class CountryRule extends BaseTimeEntity {
  @Column('uuid', { name: 'country_id' })
  countryId!: string;

  @Column('int', { name: 'version', default: 1 })
  version!: number;

  @Column('bool', { name: 'is_active', default: false })
  isActive!: boolean;

  /**
   * Document validation parameters (keep validation logic in code, store knobs here).
   */
  @Column('int', { name: 'document_min_length', nullable: true })
  documentMinLength!: number | null;

  @Column('int', { name: 'document_max_length', nullable: true })
  documentMaxLength!: number | null;

  /**
   * Debt-to-income thresholds (totalDebt / monthlyIncome).
   */
  @Column('numeric', {
    name: 'dti_approve_max',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  dtiApproveMax!: number | null;

  @Column('numeric', {
    name: 'dti_review_max',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  dtiReviewMax!: number | null;

  /**
   * Requested amount knobs.
   * - requested_amount_review_threshold: if requestedAmount exceeds this, mark REVIEW (ES requirement).
   * - requested_amount_to_monthly_income_*: requestedAmount / monthlyIncome thresholds (MX/PT requirement).
   */
  @Column('numeric', {
    name: 'requested_amount_review_threshold',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  requestedAmountReviewThreshold!: number | null;

  @Column('numeric', {
    name: 'requested_amount_to_monthly_income_approve_max',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  requestedAmountToMonthlyIncomeApproveMax!: number | null;

  @Column('numeric', {
    name: 'requested_amount_to_monthly_income_review_max',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  requestedAmountToMonthlyIncomeReviewMax!: number | null;

  /**
   * General income/stability knobs (used by IT/PT as needed).
   */
  @Column('numeric', {
    name: 'min_monthly_income',
    nullable: true,
    transformer: numericToNumberTransformer,
  })
  minMonthlyIncome!: number | null;

  /**
   * Score knobs (optional; useful for BR if you tie to computed riskScore).
   */
  @Column('int', { name: 'min_risk_score_approve', nullable: true })
  minRiskScoreApprove!: number | null;

  @Column('int', { name: 'min_risk_score_review', nullable: true })
  minRiskScoreReview!: number | null;

  @ManyToOne(() => Country, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id' })
  country!: Country;
}

