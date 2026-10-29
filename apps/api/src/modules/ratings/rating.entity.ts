import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RatingDirection = 'passenger_to_driver' | 'driver_to_passenger';

@Entity('ratings')
export class RatingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @Column({ type: 'enum', enum: ['passenger_to_driver', 'driver_to_passenger'] })
  direction!: RatingDirection;

  @Column({ name: 'passenger_id', type: 'bigint' })
  passengerId!: string;

  @Column({ name: 'driver_id', type: 'bigint' })
  driverId!: string;

  @Column({ type: 'decimal', precision: 2, scale: 1 })
  score!: string;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
