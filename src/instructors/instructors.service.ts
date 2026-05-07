import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Instructors } from './instructors.entity';

import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { Courses } from '../courses/courses.entity';

@Injectable()
export class InstructorsService {
    constructor(
        @InjectRepository(Instructors) private repo: Repository<Instructors>,
        private usersService: UsersService,
        @Inject(forwardRef(() => CoursesService))
        private coursesService: CoursesService
    ){}
    
    async createInstructor(instructorIds: string[], course: Courses, manager: EntityManager){
        const usersPromise = instructorIds.map(
            async(id) => {
                const user = await this.usersService.findUser(id);
                if (!user){
                    throw new BadRequestException(`User with id: ${id} doesn't exists`);
                }
                else if(user.role === 'student'){
                    throw new BadRequestException(`User with role student isn't authorized to create a course`);
                }
                return user;
            }
        );

        const users = await Promise.all(usersPromise);

        for (const user of users){
            const newInstructor = manager.create(Instructors, {
                instructor: user,
                course: course
            })
            await manager.save(newInstructor);
        }
    }

    async removeInstructors(instructorIds: string[], courseId: string, manager: EntityManager){
        const courseInstructor = await this.repo.find({
            where: {
                course: {
                    id: courseId
                }
            },
            relations: ['instructor', 'course']
        });
        const instructors = courseInstructor.map((Instructor) => Instructor.instructor.id);
        instructorIds.forEach((id) => {
            if (!instructors.includes(id)){
                throw new NotFoundException(`User with id: ${id} isn't an instructor of specified course`);
            }
        });
        for (const id of instructorIds){
            const instructor = courseInstructor.find((instructor) => instructor.instructor.id === id);
            await manager.remove(instructor);
        }
    }
    
    async getCoursesByUser(id: string){
        return await this.repo.createQueryBuilder('instructors')
        .innerJoin('instructors.instructor', 'users')
        .innerJoin('instructors.course', 'courses')
        .where('users.id = :id', {id})
        .select([
            'users.name AS "Instructor name"',
            'courses.title AS "Course name"'
        ])
        .getRawMany()
    }
}
