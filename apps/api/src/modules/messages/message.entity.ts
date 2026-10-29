import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'enum', enum: ['broadcast', 'direct'] })
  scope!: 'broadcast' | 'direct';

  @Column({
    type: 'enum',
    enum: ['all_drivers', 'all_passengers', 'all_members', 'phones'],
    default: 'all_drivers',
  })
  audience!: 'all_drivers' | 'all_passengers' | 'all_members' | 'phones';

  @Column({ name: 'target_phones', type: 'text', nullable: true })
  targetPhones!: string | null;

  @Column({
    name: 'phone_app_target',
    type: 'enum',
    enum: ['driver', 'passenger', 'both'],
    nullable: true,
  })
  phoneAppTarget!: 'driver' | 'passenger' | 'both' | null;

  @Column({ name: 'target_user_id', type: 'bigint', nullable: true })
  targetUserId!: string | null;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'sent_by_admin_id', type: 'int', nullable: true })
  sentByAdminId!: number | null;

  @Column({ name: 'delivery_status', type: 'enum', enum: ['queued', 'sent', 'failed'], default: 'queued' })
  deliveryStatus!: 'queued' | 'sent' | 'failed';

  @Column({ name: 'push_recipient_count', type: 'int', nullable: true })
  pushRecipientCount!: number | null;

  @Column({ name: 'push_detail', type: 'text', nullable: true })
  pushDetail!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
