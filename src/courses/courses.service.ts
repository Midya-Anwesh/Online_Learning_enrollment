import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Courses } from './courses.entity';
import { CreateCourseDto } from './dtos/create-course.dto';
import { InstructorsService } from '../instructors/instructors.service';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class CoursesService {
    constructor(
        @InjectRepository(Courses) private repo: Repository<Courses>,
        @Inject(forwardRef(() => InstructorsService))
        private instructorsService: InstructorsService,
        private dataSource: DataSource,
        private usersService: UsersService
    ){}

    private async exists(courses: Courses[], courseObj: CreateCourseDto){
        // Method to check if any course exists with same name and instructors in the db
        // Sort instructor ids lexicographically and check using two pointers
        courseObj.instructors = courseObj.instructors.sort()
        for (const course of courses){
            const insIds = course.instructors.map((instructor) => instructor.instructor.id).sort();
            let i = 0, j = 0;
            while ( (i < insIds.length) && (j < courseObj.instructors.length) ){
                if (insIds[i] !== courseObj.instructors[j]){
                    break;
                }
                i += 1;
                j += 1;
            }
            // If all the ids gets matched then return true, otherwise false
            if (i >= insIds.length){
                return true;
            }
        }
        return false;
    }
    async createCourse(courseObj: CreateCourseDto, currUser: ExpressRequest["currUser"]){
        const caller = await this.usersService.findUser(currUser.sub);
        if (!caller || !['admin', 'instructor'].includes(caller.role)) {
            throw new ForbiddenException('Only instructors and admins may create courses');
        }
        if (caller.role !== 'admin' && (
            courseObj.instructors.length !== 1 || courseObj.instructors[0] !== caller.id
        )) {
            throw new ForbiddenException('Instructors may only assign themselves when creating a course');
        }
        // First try to check if we have course with same title with same instructors
        // If, yes throw new bad request, otherwise let it through
        const course = await this.repo.find({where: {title: courseObj.title}, relations: ['instructors.instructor']});
        if (course.length){
            if (await this.exists(course, courseObj)){
                throw new BadRequestException('Course with same title and instructors already exists');
            }
        }
        // Create new course entry with the course id
        return this.dataSource.transaction(
            async (manager: EntityManager) => {
                const newCourse = manager.create(Courses, {title: courseObj.title});
                const savedCourse = await manager.save(newCourse);

                // Now forward the instructors to instructors service to handle their incertion
                // If, anything goes wrong, then delete the currently inserted course
                await this.instructorsService.createInstructor(courseObj.instructors, savedCourse, manager);

                // Otherwise return the currently inserted course
                return savedCourse;
            }
        )
    }

    async findCourse(id: string) {
        return this.repo.findOneBy({id});
    }

    async addInstructors(courseId: string, instructorIds: string[]){
        const course = await this.findCourse(courseId);
        if (!course){
            throw new NotFoundException(`No course found with id: ${courseId}`);
        }
        return this.dataSource.transaction(
            async (manager: EntityManager) => {
                await this.instructorsService.createInstructor(instructorIds, course, manager);
            }
        )
    }

    async removeInstructors(courseId: string, instructorIds: string[]){
        return this.dataSource.transaction(
            async (manager: EntityManager) => {
                await this.instructorsService.removeInstructors(instructorIds, courseId, manager);
            }
        )
    }


    async deleteCourse(id: string){
        const course = await this.findCourse(id);
        if (!course){
            throw new NotFoundException(`No courses found with id: ${id}`);
        }
        return await this.repo.remove(course);
    }

    async updateCourse(id: string, newTitle: string, currUser: any){
        const caller = await this.usersService.findUser(currUser.sub);
        if (!caller || !['admin', 'instructor'].includes(caller.role)) {
            throw new ForbiddenException('Only instructors and admins may update courses');
        }
        const course = await this.repo.findOne({
            where: {id},
            relations: ['instructors', 'instructors.instructor']
        });
        if (!course){
            throw new NotFoundException(`No course found with id: ${id}`);
        }
        let isValid = false;
        course.instructors.forEach((instructor) => {
            if(instructor.instructor.id === currUser.sub){
                isValid = true;
            }
        });
        if (!isValid && caller.role !== 'admin'){
            throw new ForbiddenException('You must be assigned to this course to update it');
        }
        course.title = newTitle;
        return await this.repo.save(course);
    }

    async getAllCourses(searchTerm: string = '_'){
        return this.repo.createQueryBuilder('course')
        .where('course.title LIKE :searchTerm', {searchTerm: `%${searchTerm}%`})
        .select('*')
        .getRawMany();
    }

    async getStudentCountPerCourse(courseId: string = '*'){
        let query = this.repo.createQueryBuilder('course')
        .leftJoin('course.enrollments', 'enrollments')
        .groupBy('course.id, course.title')
        .select([
            'course.title AS "Course"',
            'COUNT(enrollments.user) AS "Total Students Enrolled"'
        ]);

        if (courseId !== '*'){
            query.where('course.id = :courseId', {courseId});
        }
        return query.getRawMany();
    }

    async getLessionCount(courseId: string = '*'){
        let query = this.repo.createQueryBuilder('course')
        .leftJoin('course.lessions', 'lessions')
        .groupBy('course.id, course.title')
        .select([
            'course.title AS "Course"',
            'COUNT(lessions.id) AS "Total lessions in course"'
        ]);

        if (courseId !== '*'){
            query.where('course.id = :courseId', {courseId});
        }
        return query.getRawMany();
    }

    async courseStat(courseId: string, pageNo: number, limit: number, sort: boolean, order: "ASC"|"DESC"){
        const query = this.repo.createQueryBuilder('courses')
        .leftJoin('courses.lessions', 'lessions')
        .leftJoin('courses.instructors', 'instructors')
        .leftJoin('courses.enrollments', 'enrollments')
        .groupBy('courses.id, courses.title')
        .select([
            'courses.title AS `Course`',
            'COUNT(DISTINCT(instructors.id)) AS `Number of instructors`',
            'COUNT(DISTINCT(lessions.id)) AS `Number of lessions`',
            'COUNT(DISTINCT(enrollments.id)) AS `Number of Enrolled Student`'
        ])
        .skip((pageNo-1)*limit)
        .limit(limit);

        if (sort){
            query.orderBy('`Number of Enrolled Student`', order);
        }

        if (courseId !== '*'){
            return await query.where('courses.id = :courseId', {courseId}).getRawMany();
        }

        return await query.getRawMany();
    }
}
