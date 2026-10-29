import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('passengers')
export class PassengerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'app_client_id', type: 'varchar', length: 64, unique: true, nullable: true })
  appClientId!: string | null;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 128, nullable: true })
  displayName!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'points_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  pointsBalance!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
