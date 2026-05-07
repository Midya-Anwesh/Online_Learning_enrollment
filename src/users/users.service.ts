import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from './users.entity';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUsersDto } from './dtos/update-user.dto';
import type { Request as ExpressRequest } from 'express';
import { AssignUserRoleDto } from './dtos/assign-user-role.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(Users) private repo: Repository<Users>
    ){}

    async createUser(userObj: CreateUserDto) {
        if (await this.repo.findOne({where: {email: userObj.email}})){
            throw new BadRequestException(`User already exists with mail id: ${userObj.email}`);
        }
        const newUser = this.repo.create(userObj);
        return await this.repo.save(newUser);
    }

    async findUser(id: string) {
        return await this.repo.findOneBy({id});
    }

    async findByEmail(email: string){
        return await this.repo.findOneBy({email});
    }

    async saveUser(user: Users){
        return await this.repo.save(user);
    }

    async removeUser(id: string){
        const user = await this.findUser(id as string);
        if (!user){
            throw new NotFoundException(`No user found with id: ${id}`);
        }
        return this.repo.remove(user);
    }

    async assignRole(roleUpdationObj: AssignUserRoleDto){
        const user = await this.findByEmail(roleUpdationObj.email)
        if (!user){
            throw new NotFoundException(`No users with email: ${roleUpdationObj.email} esists`);
        }
        user.role = roleUpdationObj.role;
        return await this.repo.save(user);
    }

    async updateUser(updateObj: UpdateUsersDto, currUser: ExpressRequest["currUser"]){
        if ( (updateObj.oldEmail !== currUser?.email) && (currUser?.role !== 'admin')) {
            throw new BadRequestException(`Logged in users can update their profile only`);
        }
        const user = await this.findByEmail(updateObj.oldEmail);
        if (!user){
            throw new NotFoundException(`No users found with email: ${updateObj.oldEmail}`);
        }
        const updatedUser = Object.assign(user, updateObj);
        return await this.repo.save(updatedUser);
    }

    async getAllUsers(){
        return this.repo.createQueryBuilder('users')
        .select('*')
        .getRawMany();
    }

    async getUserByRole(role: string){
        return this.repo.find({where: {role}});
    }

    async enrolledCourses(id: string){
        return await this.repo.createQueryBuilder('users')
        .innerJoin('users.enrollments', 'enrollments')
        .innerJoin('enrollments.course', 'courses')
        .where('users.id = :id', {id})
        .select([
            'users.name AS "name"',
            'courses.title AS "Course Title"',
            'enrollments.enrolledOn AS "Enrollment Date"'
        ])
        .getRawMany();
    }

    async viewProfile(id: string){
        const result = await this.repo.findOne(
            {
                where: {id}, relations: ['instructor', 'instructor.course', 'enrollments', 'enrollments.course'],
                select: {
                    id: true,
                    name: true,
                    role: true,

                    instructor: {
                        id: true,
                        course: {
                            title: true
                        }
                    },

                    enrollments: {
                        id: true,
                        course: {
                            title: true
                        }
                    }
                }
            },
        )

        return {
            "name": result?.name,
            "enrolled courses": result?.enrollments.map((enrollment) => enrollment.course.title),
            "created courses": result?.instructor.map((instructor) => instructor.course.title)
        }
    }
}
