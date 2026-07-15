import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NoteChunk } from './note-chunk.entity';
@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  text: string;

  @Column('varchar', { length: 255, default: 'default_user' })
  userId: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @OneToMany(() => NoteChunk, (chunk) => chunk.note, { cascade: true })
  chunks: NoteChunk[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
