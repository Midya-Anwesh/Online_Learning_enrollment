import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Enrollments } from "../enrollments/enrollments.entity";
import { Instructors } from "../instructors/instructors.entity";
import { Lessions } from "../lessions/lessions.entity";

@Entity()
export class Courses {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @OneToMany(() => Enrollments, (enrollment) => enrollment.course, {cascade: true})
    enrollments: Enrollments[]

    @OneToMany(() => Instructors, (instructor) => instructor.course, {cascade: true})
    instructors: Instructors[]

    @OneToMany(() => Lessions, (lession) => lession.course, {cascade: true})
    lessions: Lessions[]
}