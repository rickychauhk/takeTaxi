import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('order_scheduled_reminder_sent')
export class OrderScheduledReminderSentEntity {
  @PrimaryColumn({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @PrimaryColumn({ name: 'minutes_before', type: 'int' })
  minutesBefore!: number;

  @Column({ name: 'sent_at', type: 'datetime', precision: 6 })
  sentAt!: Date;
}
