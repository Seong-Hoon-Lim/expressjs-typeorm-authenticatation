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
type JWTUser = {
    email: string;
};
import {DataSource} from "typeorm";
import cookieParser from 'cookie-parser';

dotenv.config();
const app: Express = express();

app.use(express.json());
app.use(cookieParser());
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

//로그인 시 jwt 토큰 발행 로직
let refreshTokens: string[] = []; //나중에 refreshToken 은 DB 에 저장해줘야 됨
app.post('/auth/login', async (req: Request, res: Response) => {
    const email: string = req.body.email;
    const user: JWTUser = { email: email };

    //jwt 를 활용하여 액세스 토큰 발급 (유효기간 30초 설정)
    const accessToken: string = jwt.sign(
        user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30s' });
    //jwt 를 활용하여 리프레시 토큰 발급 (유효기간 1일 설정)
    const refreshToken: string = jwt.sign(
        user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });

    refreshTokens.push(refreshToken);

    //발급된 refreshToken 을 쿠키에 넣어주기
    res.cookie('jwt', refreshToken, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: accessToken });
    console.log('발급 된 accessToken: ' + accessToken);
});

//발급된 리프레시 refreshToken 을 활용하여 accessToken 재발급 로직
app.get('/auth/refresh', (req: Request, res: Response) => {
    const cookies = req.cookies;
    console.log('req.cookies: ', cookies);
    if (!cookies?.jwt) return res.sendStatus(403);

    const refreshToken = cookies.jwt;
    //refreshToken 이 refreshTokens 의 [] 에 포함여부 검증
    if (!refreshToken.includes(refreshToken)) {
        return res.sendStatus(403);
    }

    //token 이 유효한 토큰인지 검증
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user) => {
        if (err) {
            console.error(err);
            return res.sendStatus(403);
        }
        //accessToken 생성
        //jwt 를 활용하여 액세스 토큰 발급 (유효기간 30초 설정)
        const accessToken: string = jwt.sign(
            user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30s' });
        res.json({ accessToken });
    });
});

// 인증 미들웨어 로직
function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader: string | undefined = req.headers['authorization'];
    const token: string | undefined= authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });

    //토큰 유효성 검증
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: JWTUser) => {
        if (err) {
            console.error(err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

//jwt 인증 로직(인증 성공 시 로그인 성공)
app.post('/auth/signin', authMiddleware, async (req: Request, res: Response) => {
    const email = req.user?.email;
    if (!email) {
        return res.status(400).json({ message: '회원 메일을 찾을 수 없음' });
    }
    try {
        const userRespository = AppDataSource.getRepository(User);
        const userEntity = await userRespository.findOne({ where: { email: email } });
        if (!userEntity) {
            return res.status(404).json({ message: '회원을 찾을 수 없음' });
        }
        // 로그인 성공 시, 리프레시 토큰도 생성하고 쿠키로 클라이언트에게 전달
        const user = { email: email };  // 이 부분을 추가
        const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);
        res.cookie('jwt', refreshToken);
        res.json(userEntity);
        console.log('로그인 성공');
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
