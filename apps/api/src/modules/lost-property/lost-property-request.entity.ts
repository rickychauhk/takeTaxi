import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LostPropertyStatus = 'active' | 'expired';

@Entity('lost_property_requests')
@Index('idx_lost_property_active', ['status', 'expiresAt'])
@Index('idx_lost_property_passenger', ['passengerId'])
export class LostPropertyRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'passenger_id', type: 'varchar', length: 36 })
  passengerId!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 120 })
  itemName!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'lost_at', type: 'datetime' })
  lostAt!: Date;

  @Column({ name: 'image_paths', type: 'json', nullable: true })
  imagePaths!: string[] | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32 })
  contactPhone!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 80 })
  contactName!: string;

  @Column({ type: 'enum', enum: ['active', 'expired'], default: 'active' })
  status!: LostPropertyStatus;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'expired_notified_at', type: 'datetime', nullable: true })
  expiredNotifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
