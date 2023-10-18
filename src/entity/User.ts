import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, BeforeUpdate } from "typeorm"
import bcrypt from 'bcryptjs';

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    email: string

    @Column()
    password: string

    @Column()
    name: string

    /*
     User 객체의 인스턴스가 DB 에 insert, update 되기 전에
     메소드가 hashPassword 메소드가 자동으로 호출 됨
     */
    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword(): Promise<void> {
        const saltRounds = 10;
        this.password = await bcrypt.hash(this.password, saltRounds);
    }
    async comparePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password);
    }
}
