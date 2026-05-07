import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoursesService } from '../courses/courses.service';
import { Courses } from '../courses/courses.entity';
import { Lessions } from './lessions.entity';
import { CreateLessionsDto } from './dtos/create-lessions.dto';
import { UpdateLessionsDto } from './dtos/update-lessions.dto';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class LessionsService {
    constructor(
        @InjectRepository(Lessions) private repo: Repository<Lessions>,
        private coursesService: CoursesService,
        @InjectRepository(Courses) private courseRepo: Repository<Courses>
    ){}

    async createLession(lessionObj: CreateLessionsDto){
        // Find if the provided courseId valid or not, if not throw not found 
        const course = await this.coursesService.findCourse(lessionObj.courseId);
        if (!course){
            throw new NotFoundException(`No course found with id: ${lessionObj.courseId}`);
        }

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
        if (!currUser){
            throw new BadRequestException('UnIdentified user, please login');
        }

        // Check if requested course exists or not, if not throw not found
        const lession = await this.repo.findOne({
            where: {id: lessionObj.id},
            relations: ['course', 'course.instructors', 'course.instructors.instructor']
        });

        if (!lession){
            throw new NotFoundException(`No lessions found with id: ${lessionObj.id}`);
        }

        //If current user isn't an admin Check if the current user id is in the instructor list of the parent course of the lession
        if (currUser.role !== "admin"){
            const isInstructor = lession.course.instructors.some( (instructor) => instructor.instructor.id  === currUser.sub );
            if (!isInstructor){
                throw new BadRequestException("Current user isn't a instructor of the parent course of the lession");
            }
        }

        // Otherwise apply the updation and return newly saved lession
        lession.description = lessionObj.desc;
        const newLession = Object.assign(lession, lessionObj);
        return await this.repo.save(newLession);
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

    async getLessionsByCourse(courseId: string = '*'){
        let query = this.repo.createQueryBuilder('lessions')
        .innerJoin('lessions.course', 'course')
        .addSelect('course.title') // Adds title column from courses table to be included too, otherwise ommited, by default only all columns of lessions are selected

        if (courseId !== '*'){
            query.where('course.id = :courseId', {courseId})
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
