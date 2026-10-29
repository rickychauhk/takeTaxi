import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OrderChatSenderRole = 'passenger' | 'driver';

@Entity('order_chat_messages')
@Index('idx_order_chat_order_id', ['orderId'])
export class OrderChatMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @Column({ name: 'sender_role', type: 'enum', enum: ['passenger', 'driver'] })
  senderRole!: OrderChatSenderRole;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'passenger_read_at', type: 'timestamp', nullable: true })
  passengerReadAt!: Date | null;

  @Column({ name: 'driver_read_at', type: 'timestamp', nullable: true })
  driverReadAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
