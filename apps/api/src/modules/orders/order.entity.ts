import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'order_type', type: 'enum', enum: ['instant', 'scheduled', 'multi_stop', 'blind_box', 'driver_posted'], default: 'instant' })
  orderType!: 'instant' | 'scheduled' | 'multi_stop' | 'blind_box' | 'driver_posted';

  @Column({ name: 'passenger_id', type: 'bigint', nullable: true })
  passengerId!: string | null;

  @Column({ name: 'driver_id', type: 'bigint', nullable: true })
  driverId!: string | null;

  @Column({ name: 'posted_by_driver_id', type: 'bigint', nullable: true })
  postedByDriverId!: string | null;

  @Column({ type: 'enum', enum: ['pending', 'matching', 'accepted', 'en_route', 'in_trip', 'completed', 'cancelled'], default: 'pending' })
  status!: 'pending' | 'matching' | 'accepted' | 'en_route' | 'in_trip' | 'completed' | 'cancelled';

  @Column({ name: 'blind_destination_hidden', type: 'tinyint', width: 1, default: 0 })
  blindDestinationHidden!: boolean;

  @Column({ name: 'fare_estimate', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fareEstimate!: string | null;

  /** 叫車時預估駕駛路程（公里），供乘客積分計算 */
  @Column({ name: 'estimate_distance_km', type: 'decimal', precision: 10, scale: 3, nullable: true })
  estimateDistanceKm!: string | null;

  @Column({ name: 'fare_final', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fareFinal!: string | null;

  @Column({ name: 'trip_distance_km', type: 'decimal', precision: 10, scale: 3, nullable: true })
  tripDistanceKm!: string | null;

  @Column({ name: 'passenger_points_awarded', type: 'decimal', precision: 12, scale: 2, nullable: true })
  passengerPointsAwarded!: string | null;

  @Column({ name: 'passenger_points_redeemed', type: 'decimal', precision: 12, scale: 2, nullable: true })
  passengerPointsRedeemed!: string | null;

  @Column({ name: 'passenger_points_discount_hkd', type: 'decimal', precision: 12, scale: 2, nullable: true })
  passengerPointsDiscountHkd!: string | null;

  @Column({
    name: 'passenger_points_hkd_per_point_at_order',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  passengerPointsHkdPerPointAtOrder!: string | null;

  @Column({ name: 'driver_points_cost_at_order', type: 'decimal', precision: 12, scale: 2, nullable: true })
  driverPointsCostAtOrder!: string | null;

  @Column({ name: 'driver_points_busy_surcharge', type: 'decimal', precision: 12, scale: 2, nullable: true })
  driverPointsBusySurcharge!: string | null;

  @Column({ name: 'driver_post_bounty_points', type: 'decimal', precision: 12, scale: 2, nullable: true })
  driverPostBountyPoints!: string | null;

  @Column({ name: 'driver_busy_region_reward_points', type: 'decimal', precision: 12, scale: 2, nullable: true })
  driverBusyRegionRewardPoints!: string | null;

  @Column({ name: 'driver_busy_region_from_area', type: 'varchar', length: 64, nullable: true })
  driverBusyRegionFromArea!: string | null;

  @Column({ name: 'driver_busy_region_to_area', type: 'varchar', length: 64, nullable: true })
  driverBusyRegionToArea!: string | null;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt!: Date | null;

  /** 乘客 App 叫車紀錄列表隱藏（非真正刪除） */
  @Column({ name: 'passenger_history_hidden_at', type: 'datetime', nullable: true })
  passengerHistoryHiddenAt!: Date | null;

  /** 乘客仍在等候接單（matching/pending）的最後 App 心跳 */
  @Column({ name: 'passenger_matching_watch_at', type: 'datetime', nullable: true })
  passengerMatchingWatchAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
