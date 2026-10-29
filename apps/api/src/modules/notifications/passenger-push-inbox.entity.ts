import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('passenger_push_inbox')
export class PassengerPushInboxEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'passenger_id', type: 'bigint' })
  passengerId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'crm_message_id', type: 'bigint', nullable: true })
  crmMessageId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
