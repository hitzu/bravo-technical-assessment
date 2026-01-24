import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { TOKEN_TYPE } from '../../common/types/token-type';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'token' })
export class Token extends BaseTimeEntity {
  @Column({ nullable: false, type: 'text' })
  token: string;

  @Column({
    nullable: false,
    type: 'enum',
    enumName: 'TOKEN_TYPE',
    enum: TOKEN_TYPE,
  })
  type: TOKEN_TYPE;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;
}
