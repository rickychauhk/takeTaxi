import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('promo_codes')
export class PromoCodeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'marks_internal_member', type: 'tinyint', width: 1, default: 1 })
  marksInternalMember!: boolean;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
