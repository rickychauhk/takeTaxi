import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mobile_app_releases')
export class MobileAppReleaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'enum', enum: ['passenger', 'driver'] })
  app!: 'passenger' | 'driver';

  @Column({ type: 'varchar', length: 64 })
  version!: string;

  @Column({ name: 'release_notes', type: 'text', nullable: true })
  releaseNotes!: string | null;

  @Column({ name: 'file_path' })
  filePath!: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', default: 0 })
  fileSizeBytes!: string;

  @Column({ name: 'uploaded_by_admin_id', type: 'int', nullable: true })
  uploadedByAdminId!: number | null;

  @Column({ name: 'is_active_uat', type: 'tinyint', width: 1, default: 0 })
  isActiveUat!: boolean;

  @Column({ name: 'is_active_prod', type: 'tinyint', width: 1, default: 0 })
  isActiveProd!: boolean;

  @Column({ name: 'deployed_uat_at', type: 'datetime', nullable: true })
  deployedUatAt!: Date | null;

  @Column({ name: 'deployed_prod_at', type: 'datetime', nullable: true })
  deployedProdAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
