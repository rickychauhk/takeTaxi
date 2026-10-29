import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('drivers')
export class DriverEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ unique: true })
  phone!: string;

  /** 收工電話 */
  @Column({ name: 'off_duty_phone', type: 'varchar', length: 32, nullable: true })
  offDutyPhone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 128, nullable: true })
  displayName!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'is_internal_member', type: 'tinyint', width: 1, default: 0 })
  isInternalMember!: boolean;

  @Column({ name: 'driver_tier', type: 'enum', enum: ['admin', 'partner', 'public'], default: 'public' })
  driverTier!: 'admin' | 'partner' | 'public';

  @Column({ name: 'verification_status', type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  verificationStatus!: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'license_number', type: 'varchar', length: 64, nullable: true })
  licenseNumber!: string | null;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 32, nullable: true })
  vehiclePlate!: string | null;

  @Column({ name: 'vehicle_plate_expiry', type: 'date', nullable: true })
  vehiclePlateExpiry!: string | null;

  @Column({ name: 'vehicle_model', type: 'varchar', length: 64, nullable: true })
  vehicleModel!: string | null;

  @Column({ name: 'first_registration_date', type: 'date', nullable: true })
  firstRegistrationDate!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 128, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 34, nullable: true })
  bankAccountNumber!: string | null;

  @Column({ name: 'points_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  pointsBalance!: string;

  @Column({ name: 'is_online', type: 'tinyint', width: 1, default: 0 })
  isOnline!: boolean;

  @Column({ name: 'suspended_permanent', type: 'tinyint', width: 1, default: 0 })
  suspendedPermanent!: boolean;

  @Column({ name: 'suspended_until', type: 'datetime', nullable: true })
  suspendedUntil!: Date | null;

  @Column({ name: 'suspended_reason', type: 'varchar', length: 255, nullable: true })
  suspendedReason!: string | null;

  /** 3 / 6 / 10；NULL = 不限公里 */
  @Column({ name: 'max_pickup_radius_km', type: 'decimal', precision: 4, scale: 1, nullable: true })
  maxPickupRadiusKm!: string | null;

  @Column({ name: 'session_version', type: 'int', default: 0 })
  sessionVersion!: number;

  @Column({ name: 'last_login_device_id', type: 'varchar', length: 64, nullable: true })
  lastLoginDeviceId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
