import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from './users.entity';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUsersDto } from './dtos/update-user.dto';
import type { Request as ExpressRequest } from 'express';
import { AssignUserRoleDto } from './dtos/assign-user-role.dto';
import { JwtTokenList } from '../auth/jwtTokenList/jwtTokenList.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(Users) private repo: Repository<Users>
    ){}

    async createUser(userObj: CreateUserDto) {
        if (await this.repo.findOne({where: {email: userObj.email}})){
            throw new BadRequestException(`User already exists with mail id: ${userObj.email}`);
        }
        // Defense in depth: never trust a caller-supplied registration role.
        const newUser = this.repo.create({...userObj, role: 'student'});
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

    async remove(user: Users){
        return await this.repo.remove(user);
    }

    async assignRole(roleUpdationObj: AssignUserRoleDto){
        const user = await this.findByEmail(roleUpdationObj.email)
        if (!user){
            throw new NotFoundException(`No users with email: ${roleUpdationObj.email} esists`);
        }
        return this.repo.manager.transaction(async manager => {
            user.role = roleUpdationObj.role;
            await manager.save(Users, user);
            await manager.update(JwtTokenList, {user: {id: user.id}}, {blockListed: true});
            return user;
        });
    }

    async updateUser(updateObj: UpdateUsersDto, currUser: ExpressRequest["currUser"]){
        const user = await this.findByEmail(updateObj.oldEmail);
        if (!user){
            throw new NotFoundException(`No users found with email: ${updateObj.oldEmail}`);
        }
        const caller = await this.findUser(currUser.sub);
        if (!caller || (caller.id !== user.id && caller.role !== 'admin')) {
            throw new ForbiddenException('You can only update your own profile');
        }
        const emailChanged = updateObj.email !== undefined && updateObj.email !== user.email;
        if (updateObj.name !== undefined) user.name = updateObj.name;
        if (updateObj.email !== undefined) user.email = updateObj.email;
        return this.repo.manager.transaction(async manager => {
            const updatedUser = await manager.save(Users, user);
            if (emailChanged) {
                await manager.update(JwtTokenList, {user: {id: user.id}}, {blockListed: true});
            }
            return updatedUser;
        });
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
