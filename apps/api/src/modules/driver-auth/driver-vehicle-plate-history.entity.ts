import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('driver_vehicle_plate_history')
export class DriverVehiclePlateHistoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'driver_id', type: 'bigint' })
  driverId!: string;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 32 })
  vehiclePlate!: string;

  @CreateDateColumn({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
