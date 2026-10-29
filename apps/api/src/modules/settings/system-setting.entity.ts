import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'setting_key', unique: true })
  settingKey!: string;

  @Column({ name: 'setting_value', type: 'longtext', nullable: true })
  settingValue!: string | null;

  @Column({ name: 'updated_by_admin_id', type: 'int', nullable: true })
  updatedByAdminId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
