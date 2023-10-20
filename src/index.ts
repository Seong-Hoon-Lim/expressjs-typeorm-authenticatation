import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from "express";
import morgan from "morgan";
import {AppDataSource} from "./data-source";
import cookieParser from 'cookie-parser';
import path from "path";
import mainRouter from "./routes/main.router";
import usersRouter from "./routes/users.router";

dotenv.config();
const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/', mainRouter);
app.use('/auth', usersRouter);

app.listen(process.env.PORT, (): void => {
    console.log(`Server Running at http://localhost:${process.env.PORT}`);
});
