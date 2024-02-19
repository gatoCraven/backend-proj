import express from "express";
import cors from "cors";
// import cookieParser from "cookie-parser"
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}));
// app.use(cookieParser);

app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true, limit:"16kb"}));
app.use(express.static("public"));

//cookie parser giving problems sending request

import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users",userRouter);

export { app };