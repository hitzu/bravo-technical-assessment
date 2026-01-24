import { Column, Entity } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';

@Entity('tenants')
export class Tenant extends BaseTimeEntity {
  @Column('text')
  name!: string;
}
