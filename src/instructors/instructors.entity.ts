import { Entity, PrimaryGeneratedColumn, ManyToOne, Unique } from 'typeorm';
import { Users } from '../users/users.entity';
import { Courses } from '../courses/courses.entity';

@Entity()
@Unique('unique_constraint_instructor', ['instructor', 'course'])
export class Instructors {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Users, (user) => user.instructor, {onDelete: 'CASCADE'})
    instructor: Users;

    @ManyToOne(() => Courses, (courses) => courses.instructors, {onDelete: 'CASCADE'})
    course: Courses;
}