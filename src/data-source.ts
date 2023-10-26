import dotenv from 'dotenv';
import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import {RefreshToken} from "./entity/RefreshToken";

dotenv.config();
export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5433,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DATABASE,
    synchronize: true,
    logging: false,
    entities: [User, RefreshToken],
    migrations: [],
    subscribers: [],
});
