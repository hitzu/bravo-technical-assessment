import { Column, Entity, Index } from 'typeorm';

import { COUNTRY_STATUS } from '../../common/types/country-status.type';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';

@Entity({ name: 'countries' })
@Index('ix_countries_status', ['status'])
export class Country extends BaseTimeEntity {
  @Column('char', { length: 2, name: 'code', unique: true })
  code!: string;

  @Column('varchar', { length: 100, name: 'name' })
  name!: string;

  @Column({
    type: 'enum',
    enum: COUNTRY_STATUS,
    enumName: 'COUNTRY_STATUS',
    default: COUNTRY_STATUS.ACTIVE,
  })
  status!: COUNTRY_STATUS;
}

