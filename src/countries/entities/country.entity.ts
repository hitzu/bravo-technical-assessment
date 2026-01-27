import { Column, Entity, Index, OneToMany } from 'typeorm';

import { COUNTRY_STATUS } from '../../common/types/country-status.type';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { CountryRule } from './country-rule.entity';

@Entity({ name: 'countries' })
@Index('ix_countries_status', ['status'])
export class Country extends BaseTimeEntity {
  @Column('char', { length: 2, name: 'code', unique: true })
  code!: string;

  @Column('varchar', { length: 100, name: 'name' })
  name!: string;

  @Column('varchar', { length: 100, name: 'document_label', nullable: true })
  documentLabel!: string | null;

  @Column('varchar', {
    length: 255,
    name: 'document_regex_pattern',
    nullable: true,
  })
  documentRegexPattern!: string | null;

  @Column('varchar', { length: 100, name: 'document_example', nullable: true })
  documentExample!: string | null;

  @Column({
    type: 'enum',
    enum: COUNTRY_STATUS,
    enumName: 'COUNTRY_STATUS',
    default: COUNTRY_STATUS.ACTIVE,
  })
  status!: COUNTRY_STATUS;

  @OneToMany(() => CountryRule, (rule) => rule.country)
  rules!: CountryRule[];
}

