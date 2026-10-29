import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('admin_users')
export class AdminUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  phone!: string | null;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'display_name' })
  displayName!: string;

  @Column({ type: 'enum', enum: ['super_admin', 'operator', 'finance', 'support'] })
  role!: 'super_admin' | 'operator' | 'finance' | 'support';

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'session_version', type: 'int', default: 0 })
  sessionVersion!: number;

  @Column({ name: 'last_login_device_id', type: 'varchar', length: 64, nullable: true })
  lastLoginDeviceId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
