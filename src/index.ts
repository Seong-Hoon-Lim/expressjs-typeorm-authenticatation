import express, { Express, Request, Response } from "express";
import morgan from "morgan";

const app: Express = express();
const PORT: Number = 4000;

app.use(express.json());
app.use(morgan('dev'));

app.listen(PORT, (): void => {
    console.log(`Server Running at http://localhost:${PORT}`);
});

