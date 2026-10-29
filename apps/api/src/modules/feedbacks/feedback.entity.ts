import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('feedbacks')
export class FeedbackEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'sender_name' })
  senderName!: string;

  @Column({ name: 'sender_phone' })
  senderPhone!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'enum', enum: ['new', 'in_progress', 'closed'], default: 'new' })
  status!: 'new' | 'in_progress' | 'closed';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
