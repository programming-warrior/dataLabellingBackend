import express from "express";
import userRouter from "./routers/user";
import workerRouter from "./routers/worker";
import path from "path"

import cors from "cors";
const app=express();

export const JWT_SECRET="a;leropqwyerqiwheriqwueryasd,fbkalsdf";

app.use(cors());

app.use(express.json());
app.use('/static',express.static(path.join(__dirname+'/../public/uploads')));


app.use("/v1/user",userRouter);
app.use("/v1/worker",workerRouter);

app.listen(8000,()=>{
    console.log('server is listening on port 8000');
})