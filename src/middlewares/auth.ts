import express, { Express, Request, Response, NextFunction } from "express";
import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import {AppDataSource} from "../data-source";
import {RefreshToken} from "../entity/RefreshToken";
type JWTUser = {
    email: string;
};

export function checkAuthenticated(req: Request, res: Response, next: NextFunction) {
    const token: string | undefined = req.cookies.access_jwt;

    if (!token) return res.redirect('/signin');

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: JWTUser) => {
        if (err && err.name === "TokenExpiredError") {
            // Token 만료 시, 리프레시 토큰을 사용하여 액세스 토큰 재발급
            return refreshToken(req, res, next);
        } else if (err) {
            console.error(err);
            return res.redirect('/signin');
        }
        req.user = user;
        next();
    });
}
export function checkNotAuthenticated(req: Request, res: Response, next: NextFunction) {
    const token: string | undefined = req.cookies.access_jwt;;

    if (token == null) return next();  // 변경: 토큰이 없으면 다음 미들웨어/라우터로 진행

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: JWTUser) => {
        if (err) {
            console.error(err);
            return next();  // 변경: 토큰 검증 실패시 다음 미들웨어/라우터로 진행
        }
        return next();  // 유효한 토큰이 있으면 다음 미들웨어/라우터로 진행
    });
}

// 리프레시 토큰으로 액세스 토큰 재발급 함수
export let refreshTokens: string[] = []; //나중에 refreshToken 은 DB 에 저장해줘야 됨
export function refreshToken(req: Request, res: Response, next: NextFunction) {
    const refreshToken = req.cookies.refresh_jwt;

    AppDataSource.getRepository(RefreshToken)
        .findOne({where: {token: refreshToken}})
        .then(refreshTokenEntity => {
            if (!refreshTokenEntity) {
                return res.sendStatus(403);
            }

            jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET ?? '', (err: JsonWebTokenError | null, user: JWTUser) => {
                if (err) {
                    console.error(err);
                    return res.sendStatus(403);
                }

                const accessToken: string = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '30s'});

                res.cookie('access_jwt', accessToken, {httpOnly: true});
                req.user = user;
                next();
            });
        })
        .catch(err => {
            console.error(err);
            return res.sendStatus(403);
        });
}