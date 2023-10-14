import dotenv from 'dotenv';
import express, { Express, Request, Response } from "express";
import morgan from "morgan";
import jwt from 'jsonwebtoken';
import {AppDataSource} from "./data-source";
import {User} from "./entity/User";
import {DataSource} from "typeorm";

dotenv.config();
const app: Express = express();

app.use(express.json());
app.use(morgan('dev'));

AppDataSource
    .initialize()
    .then(() => {
        console.log('Data Source has been initialized')
    })
    .catch((err) => {
        console.error('Error during Data Source initialization', err);
    });

//회원정보 DB 저장 로직
app.post('/signup', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        //새로운 user 객체 생성
        const user = new User();
        user.email = email;
        user.password = password;
        user.name = name;
        //DB 저장
        await AppDataSource.getRepository(User).save(user);
        res.status(201).send({ message: 'User registered successfully!', user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

app.post('/auth/token/access', async (req, res) => {
    const username = req.body.username;
    const user = { name: username };
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKKEN_SECRET);
    res.json({ accessToken: accessToken });
    console.log('accessToken: ' + accessToken);
});

let refreshTokens = [];
app.post('/auth/login', (req, res) => {
    
});

app.listen(process.env.PORT, (): void => {
    console.log(`Server Running at http://localhost:${process.env.PORT}`);
});

