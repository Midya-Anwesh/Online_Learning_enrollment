import { Courses } from '../courses/courses.entity';
import { Users } from '../users/users.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';

@Entity()
@Unique('unique_constraint_enrollment', ['user', 'course'])
export class Enrollments {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    enrolledOn: Date;

    @ManyToOne(() => Users, (user) => user.enrollments, {onDelete: 'CASCADE'})
    user: Users;

    @ManyToOne(() => Courses, (course) => course.enrollments, {onDelete: 'CASCADE'})
    course: Courses;
}