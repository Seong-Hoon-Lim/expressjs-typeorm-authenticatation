import express, { Express, Request, Response } from "express";
import morgan from "morgan";
import {AppDataSource} from "./data-source";
import {User} from "./entity/User";
import {DataSource} from "typeorm";

const PORT: number = 4000;

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
    })

app.listen(PORT, (): void => {
    console.log(`Server Running at http://localhost:${PORT}`);
});

