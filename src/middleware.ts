import jwt, { JwtPayload } from "jsonwebtoken";

import {Request,Response,NextFunction} from "express";
import { JWT_SECRET } from ".";
import { PrismaClient } from "@prisma/client";

interface CustomRequest extends Request {
    userId?: string;
}


export const authMiddleware=async(req:CustomRequest,res:Response,next:NextFunction)=>{

    const authHeader=req.headers['authorization']?.split(' ')[1];
    console.log(authHeader);
    if(!authHeader) return res.status(403).json({message:"you are not logged in"}); 

    try{
        const decoded=jwt.verify(authHeader,JWT_SECRET) as JwtPayload;

        if(decoded.userId){
          
            req.userId=decoded.userId;
            return next();
        }
        else{
            return res.status(403).json({message:"you are not logged in"})
        }
    }
    
    catch(e){
        return res.status(403).json({message:"you are not logged in"})
    }
}