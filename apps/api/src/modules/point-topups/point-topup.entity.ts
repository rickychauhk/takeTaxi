import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('point_topups')
export class PointTopupEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'driver_id', type: 'bigint' })
  driverId!: string;

  @Column({ name: 'amount_points', type: 'decimal', precision: 12, scale: 2 })
  amountPoints!: string;

  @Column({ name: 'package_id', type: 'bigint', nullable: true })
  packageId!: string | null;

  @Column({ name: 'price_hkd', type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceHkd!: string | null;

  @Column({ name: 'receipt_image_path' })
  receiptImagePath!: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 128, nullable: true })
  bankName!: string | null;

  @Column({ name: 'transfer_at', type: 'datetime', nullable: true })
  transferAt!: Date | null;

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'reviewed_by_admin_id', type: 'int', nullable: true })
  reviewedByAdminId!: number | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
