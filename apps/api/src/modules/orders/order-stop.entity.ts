import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_stops')
export class OrderStopEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @Column()
  seq!: number;

  @Column({ name: 'address_text', type: 'varchar', length: 512, nullable: true })
  addressText!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: string;
}
