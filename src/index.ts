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
import path from "path";

dotenv.config();
const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//회원 가입 form 뷰
app.get('/signup', (req: Request, res: Response) => {
   res.render('signup');
});

//회원정보 DB 저장 로직
app.post('/auth/signup', async (req: Request, res: Response) => {
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

//로그인 화면 form 뷰
app.get('/signin', (req: Request, res: Response) => {
   res.render('signin');
});

//로그인 절차 로직(JWT 발급 및 유효성 검증과 인증 성공 시 로그인 성공)
let refreshTokens: string[] = []; //나중에 refreshToken 은 DB 에 저장해줘야 됨
app.post('/auth/signin', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const userRepository = AppDataSource.getRepository(User);
        const userEntity = await userRepository.findOne({ where: { email: email } });

        if (!userEntity || !await userEntity.comparePassword(password)) {
            return res.status(404).json({ message: '회원을 찾을 수 없거나 비밀번호가 잘못됨' });
        }

        const user: JWTUser = { email: email };

        // JWT 토큰 발행
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30s' });
        const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });

        refreshTokens.push(refreshToken);

        // 토큰 쿠키에 저장
        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        });

        // 인증된 사용자 정보 반환
        res.json({ accessToken, userEntity });

        console.log('로그인 및 토큰 발행 성공');
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('로그인 중 에러 발생:', error);
        }
        res.status(500).send({ message: '내부 서버 에러' });
    }
});

//발급된 리프레시 refreshToken 을 활용하여 accessToken 재발급 로직
app.get('/auth/refresh', (req: Request, res: Response) => {
    const cookies = req.cookies;
    console.log('req.cookies: ', cookies);
    if (!cookies?.jwt) return res.sendStatus(403);

    const refreshToken = cookies.jwt;
    //refreshToken 이 refreshTokens 의 [] 에 포함여부 검증
    if (!refreshTokens.includes(refreshToken)) {
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

//로그인 화면 form 뷰
app.get('/signin', (req: Request, res: Response) => {
    res.render('signin');
});

// 인증 미들웨어 로직 (로그인 된 회원이 접근 할 수 있는 엔드포인트에 적용)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token: string | undefined = req.cookies.jwt;  // 쿠키에서 토큰을 가져옴

    if (token == null) return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });

    //토큰 유효성 검증
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: JWTUser) => {
        if (err) {
            console.error(err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

//인증된 회원만 볼 수 있는 뷰
app.get('/', authMiddleware, async (req: Request, res: Response) => {
   res.render('index');
});

app.listen(process.env.PORT, (): void => {
    console.log(`Server Running at http://localhost:${process.env.PORT}`);
});
