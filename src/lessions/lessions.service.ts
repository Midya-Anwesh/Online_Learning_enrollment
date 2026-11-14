import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoursesService } from '../courses/courses.service';
import { Lessions } from './lessions.entity';
import { CreateLessionsDto } from './dtos/create-lessions.dto';
import { UpdateLessionsDto } from './dtos/update-lessions.dto';
import type { Request as ExpressRequest } from 'express';
import { UsersService } from '../users/users.service';
import { Instructors } from '../instructors/instructors.entity';

@Injectable()
export class LessionsService {
    constructor(
        @InjectRepository(Lessions) private repo: Repository<Lessions>,
        private coursesService: CoursesService,
        private usersService: UsersService
    ){}

    async createLession(lessionObj: CreateLessionsDto, currUser: ExpressRequest["currUser"]){
        // Find if the provided courseId valid or not, if not throw not found 
        const course = await this.coursesService.findCourse(lessionObj.courseId);
        if (!course){
            throw new NotFoundException(`No course found with id: ${lessionObj.courseId}`);
        }
        await this.assertCanManageCourse(course.id, currUser);

        // Otherwise, create the lession
        const newLession = this.repo.create({
            name: lessionObj.name,
            code: lessionObj.code,
            description: lessionObj.desc,
            course: course
        })

        // Save it and return it
        return await this.repo.save(newLession);
    }


    async updateLession(lessionObj: UpdateLessionsDto, currUser: ExpressRequest["currUser"]){
        // Check if requested course exists or not, if not throw not found
        const lession = await this.repo.findOne({
            where: {id: lessionObj.id},
            relations: ['course', 'course.instructors', 'course.instructors.instructor'],
            select: {
                id: true,
                course: {
                    id: true,
                    instructors: {
                        id: true,
                        instructor: {
                            id: true
                        }
                    }
                }
            }
        });

        if (!lession){
            throw new NotFoundException(`No lessions found with id: ${lessionObj.id}`);
        }
        

        await this.assertCanManageCourse(lession.course.id, currUser);

        // Otherwise apply the updation and return newly saved lession
        if (lessionObj.name !== undefined) lession.name = lessionObj.name;
        if (lessionObj.code !== undefined) lession.code = lessionObj.code;
        if (lessionObj.desc !== undefined) lession.description = lessionObj.desc;
        return await this.repo.save(lession);
    }

    async deleteLession(id: string){
        // If the lession doesn't exists throw not found
        const lession = await this.repo.findOneBy({id});
        if (!lession){
            throw new NotFoundException(`No lessions found with id: ${id}`);
        }

        // Otherwise remove the lession
        return await this.repo.remove(lession);
    }

    private async assertCanManageCourse(courseId: string, currUser: ExpressRequest["currUser"]){
        const user = await this.usersService.findUser(currUser.sub);
        if (!user || !['admin', 'instructor'].includes(user.role)) {
            throw new ForbiddenException('Only instructors and admins may manage lessons');
        }
        if (user.role === 'admin') return;
        const assigned = await this.repo.manager.exists(Instructors, {
            where: {instructor: {id: user.id}, course: {id: courseId}}
        });
        if (!assigned) {
            throw new ForbiddenException('You must be assigned to the parent course to manage lessons');
        }
    }

    async getLessionsByCourse(courseId: string, currUser: ExpressRequest["currUser"]){
        const user = await this.usersService.findUser(currUser.sub);
        if (!user) throw new ForbiddenException('Registered account required');
        let query = this.repo.createQueryBuilder('lessions')
        .innerJoin('lessions.course', 'course')
        .addSelect('course.title') // Adds title column from courses table to be included too, otherwise ommited, by default only all columns of lessions are selected
        if (user.role !== 'admin') {
            query = query
                .leftJoin('course.enrollments', 'enrollment', 'enrollment.userId = :userId', {userId: user.id})
                .leftJoin('course.instructors', 'assignment', 'assignment.instructorId = :userId', {userId: user.id})
                .where('(enrollment.id IS NOT NULL OR (:isInstructor = 1 AND assignment.id IS NOT NULL))', {
                    isInstructor: user.role === 'instructor' ? 1 : 0
                });
        }

        if (courseId !== '*'){
            query.andWhere('course.id = :courseId', {courseId})
        }

        const ans = await query.getMany();
        const res = {};

        ans.forEach((lession: Lessions) => {
            const {course, id, ...toPush} = lession;
            if (course.title in res){
                res[lession.course.title].push(toPush);
            }
            else{
                res[course.title] = [toPush];
            }
        });
        return res;
    }
}
