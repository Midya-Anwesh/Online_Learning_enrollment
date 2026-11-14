import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEnrollmentDto } from './dtos/create-enrollment.dto';
import { Enrollments } from './enrollments.entity';
import { CoursesService } from '../courses/courses.service';
import { UsersService } from '../users/users.service';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class EnrollmentsService {
    constructor(
        @InjectRepository(Enrollments) private repo: Repository<Enrollments>,
        private usersService: UsersService,
        private coursesService: CoursesService
    ){}

    async createEnrollment(enrollmentObj: CreateEnrollmentDto, currUser: ExpressRequest["currUser"]){
        // If current User is an admin, we will choose userId sent in the body to be enrolled, if not sent then we will enroll the admin
        // For other users they can only enroll themselves the userId sent in body will be ignored for them
        let user = await this.usersService.findUser(currUser.sub);
        if (!user){
            throw new BadRequestException(`Please login to enroll...`);
        }
        let userId = currUser.sub;
        if (user.role === "admin"){
            userId = enrollmentObj.userId ?? userId;
            user = await this.usersService.findUser(userId);
            if (!user){
                throw new BadRequestException(`No user found with id: ${userId}`);
            }
        }
        const course = await this.coursesService.findCourse(enrollmentObj.courseId as string);

        if ((!user) || (!course)){
            throw new NotFoundException(`Either user of course doesn't esists`);
        }

        const newEnrollment = this.repo.create({
            user,
            course
        })

        return await this.repo.save(newEnrollment);
    }

    async getEnrollments(userId: string, currUser: ExpressRequest["currUser"]){
        const caller = await this.usersService.findUser(currUser.sub);
        if (!caller || (caller.role !== 'admin' && userId !== caller.id)) {
            throw new ForbiddenException('Only admins may read other users’ enrollments');
        }
        let query =  this.repo.createQueryBuilder('enrollments')
        .innerJoin('enrollments.user', 'user')
        .innerJoin('enrollments.course', 'course')
        .select([
            'user.name AS "name"',
            'user.email AS "email"',
            'course.title AS "Course"',
            'enrollments.enrolledOn AS "Enrolled On"'
        ]);
        if (userId !== '*'){
            query = query.where('user.id = :id', {id: userId});
        }
        return query.getRawMany();
    }

    async deleteEnrollment(courseId: string, userId: string, currUser: ExpressRequest["currUser"]){
        let user = await this.usersService.findUser(currUser.sub);
        if (!user){
            throw new BadRequestException(`Please login to delete account...`);
        }
        // If we want to delete any Other user then currUser Should be admin, it's optional because in other cases when user unenroll themselves we don't bother about it
        if (currUser.sub !== userId){
            if (user.role !== "admin"){
                throw new BadRequestException(`Only admins can un enroll anyone, other users may unenroll themselves only`);
            }
            user = await this.usersService.findUser(userId);
            if (!user){
                throw new NotFoundException(`No user found with id: ${userId}`);
            }
        }
        // Check if the user is enrolled in the course or not
        const enrollment = await this.repo.findOne({
            where: {
                course: {
                    id: courseId
                },
                user: {
                    id: userId
                }
            },
            select: {
                course: true,
                user: {
                    id: true,
                    email: true,
                    name: true
                }
            }
        });

        if (!enrollment){
            throw new NotFoundException(`No enrollment found involving user with id: ${userId} and course with id: ${courseId}`);
        }

        return await this.repo.remove(enrollment);
    }

}
