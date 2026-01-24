import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class BaseTimeEntity extends BaseEntity {
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
