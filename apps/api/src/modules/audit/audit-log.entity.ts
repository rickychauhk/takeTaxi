import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'actor_type', type: 'enum', enum: ['admin', 'system', 'driver', 'passenger'] })
  actorType!: 'admin' | 'system' | 'driver' | 'passenger';

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId!: number | null;

  @Column({ type: 'varchar', length: 128 })
  action!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 64, nullable: true })
  resourceType!: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 64, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
