import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('document_uploads')
export class DocumentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'driver_id', type: 'bigint' })
  driverId!: string;

  @Column({ name: 'doc_type', type: 'enum', enum: ['driving_license', 'driver_id', 'vehicle_registration', 'other'] })
  docType!: 'driving_license' | 'driver_id' | 'vehicle_registration' | 'other';

  @Column({ name: 'file_path' })
  filePath!: string;

  @Column({ name: 'review_status', type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  reviewStatus!: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'reviewed_by_admin_id', type: 'int', nullable: true })
  reviewedByAdminId!: number | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
