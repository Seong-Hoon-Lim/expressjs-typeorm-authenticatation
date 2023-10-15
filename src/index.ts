import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from "express";
//Request 타입 확장
declare module 'express-serve-static-core' {
    interface Request {
        user?: any;
    }
}
import morgan from "morgan";
import jwt, { JsonWebTokenError } from 'jsonwebtoken';
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
        console.log('데이터 소스가 초기화 되었습니다.');
    })
    .catch((err: Error) => {
        console.error('데이터 초기화 중 에러 발생: ', err);
    });

//회원정보 DB 저장 로직
app.post('/signup', async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    try {
        //새로운 user 객체 생성
        const user = new User();
        user.email = email;
        user.password = password;
        user.name = name;
        //DB 저장
        await AppDataSource.getRepository(User).save(user);
        res.status(201).send({ message: '회원 등록 성공!', user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('회원 등록 중 에러 발생: ', error);
        }
        res.status(500).send({ message: '내부 서버 에러' });
    }
});

//엑세스 토큰 발행 로직
app.post('/auth/token/access', async (req: Request, res: Response) => {
    const email: string = req.body.email;
    const user = { email: email };
    const accessToken: string = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
    res.json({ accessToken: accessToken });
    console.log('accessToken: ' + accessToken);
});

//인증 미들웨어 로직
function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader: string = req.headers['authorization'];
    const token: string = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });
    //process.env.ACCESS_TOKKEN_SECRET 값이 null 또는 undefined일 경우 빈 문자열 ''를 반환
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: any) => {
        console.error(err);
        if (err) {
            console.error(err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

app.post('/auth/login', authMiddleware, async (req: Request, res: Response) => {
    //req.user 가 null 또는 undefined 인지 검증
    const email = req.user?.email;
    if (!email) {
        return res.status(400).json({ message: '회원 메일을 찾을 수 없음' });
    }
    try {
        const userRespository = AppDataSource.getRepository(User);
        const userEntity = await userRespository.findOne({ where: { email: email }});
        if (!userEntity) {
            return res.status(404).json({ message: '회원을 찾을 수 없음' });
        }
        res.json(userEntity);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('회원 찾는 중 에러 발생:', error);
        }
        res.status(500).send({ message: '내부 서버 에러' });
    }
});

app.listen(process.env.PORT, (): void => {
    console.log(`Server Running at http://localhost:${process.env.PORT}`);
});

