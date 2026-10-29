import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_status_events')
export class OrderStatusEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus!: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32 })
  toStatus!: string;

  @Column({ name: 'actor_type', type: 'enum', enum: ['admin', 'driver', 'passenger', 'system'] })
  actorType!: 'admin' | 'driver' | 'passenger' | 'system';

  @Column({ name: 'actor_id', type: 'bigint', nullable: true })
  actorId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
