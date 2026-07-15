import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity('note_chunks')
export class NoteChunk {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Note, (note) => note.chunks, { onDelete: 'CASCADE' })
  note: Note;

  @Column()
  noteId: number;

  @Column()
  chunkIndex: number;

  @Column('text')
  text: string;

  @Column('int')
  tokenCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
