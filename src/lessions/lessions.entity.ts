import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from "typeorm";
import { Courses } from "../courses/courses.entity";

@Unique('lession_unq_constraint', ['code', 'course'])
@Entity()
export class Lessions {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'text'})
    name: string;

    @Column({type: 'varchar', length: 10})
    code: string;

    @Column({type: 'text'})
    description: string;

    @ManyToOne(() => Courses, (course) => course.lessions, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
    course: Courses
}