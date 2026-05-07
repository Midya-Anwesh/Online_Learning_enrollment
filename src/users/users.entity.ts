import { Entity, PrimaryGeneratedColumn, Column, OneToMany} from "typeorm";
import { Enrollments } from "../enrollments/enrollments.entity";
import { Instructors } from "../instructors/instructors.entity";

@Entity()
export class Users {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: "varchar", length: 50, nullable: false})
    name: string;

    @Column()
    role: string;

    @Column({unique: true})
    email: string;

    @Column()
    password: string;

    @OneToMany(() => Enrollments, (enrollment) => enrollment.user, {cascade: true})
    enrollments: Enrollments[]

    @OneToMany(() => Instructors, (instructor) => instructor.instructor, {cascade: true})
    instructor: Instructors[]
}