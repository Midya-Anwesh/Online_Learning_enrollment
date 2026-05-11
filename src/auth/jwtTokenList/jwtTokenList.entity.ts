import { Users } from "../../users/users.entity";
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Unique } from "typeorm";

@Entity()
@Unique('UNC_user_token_unique', ['user', 'tokenIdentifier'])
export class JwtTokenList {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("uuid")
    tokenIdentifier: string;

    @Column("boolean", {default: false})
    blockListed: boolean;

    @ManyToOne(() => Users, (user) => user.tokens, {
        onDelete: 'SET NULL'
    })
    user: Users;
}