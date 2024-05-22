import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { Request, Response } from "express";
import jwt, { sign } from "jsonwebtoken";
import { JWT_SECRET } from "..";
import { authMiddleware } from "../middleware";
import { createTaskInput } from "../types";
import z from "zod";
import { TOTAL_DECIMALS } from "../config";
import nacl from "tweetnacl";
import multer from "multer";
import { Transaction,PublicKey, Connection } from "@solana/web3.js";

const connection=new Connection("https://api.devnet.solana.com");
const WALLET_ADDRESS="CUQWET53K6d51L8XnQ4L1HQb3ZUZ5xNSFafaXjoXofzB";

interface CustomRequest extends Request {
    userId?: string;
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, `${__dirname}/../../public/uploads`)
    },
    filename: function (req:CustomRequest, file, cb) {
        if(file.mimetype=='image/png' || file.mimetype==='image/jpg' || file.mimetype==='image/jpeg'){
            const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
            const fileType=file.originalname.split('.')[1];
            cb(null, req.userId+ '-' + uniqueSuffix+'.'+fileType);
        }
        else{
            cb(new Error("file not supported"),"");
        }
    }
  })

const upload = multer({ storage: storage })


const router = Router();

const prismaClient = new PrismaClient();



router.post('/uploads',[authMiddleware,upload.single('file')],(req:CustomRequest,res:Response)=>{
    res.json({
        "file":req.file?.filename,
    }).end();
})



router.get('/task', authMiddleware, async (req: CustomRequest, res) => {
    const taskId = z.string().safeParse(req.query.taskId);

    const userId = z.number().safeParse(req.userId);
 
    

    if (!taskId.success || !userId.success) return res.status(411).json({ message: "invalid task id or user id" })


    const taskDetails = await prismaClient.task.findFirst({
        where: {
            id: Number(taskId.data),
            user_id: Number(userId.data)
        },
        include:{
            option:true,
        }
    })


    if (!taskDetails) {
        return res.status(411).json({
            message: "you do not have access to the task"
        })
    }

    

    const responses = await prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId.data)
        },
        include: {
            option: true,
        }
    })

    const result: {
        [key: string]: {
            count: number,
            option: {
                image_url: string,
            }
        }
    } = {}


    taskDetails.option.forEach((option)=>{
            result[option.id] = {
                count: 0,
                option: {
                    image_url: option.image_url,
                }
            }
    })

    responses.forEach(r => {
        result[r.option_id].count++;
    })

    return res.status(200).json({result,title:taskDetails.title}).end();
})

router.post('/task', authMiddleware, async (req: CustomRequest, res) => {
    // @ts-ignore
    const userId = parseInt(req.userId);

    const body = req.body;

    const parsedBody = createTaskInput.safeParse(body);

    const user=await prismaClient.user.findFirst({
        where:{
            id:Number(req.userId),
        }
    })

    if (!parsedBody.success) {
        return res.status(411).json({
            message: "you have sent the wrong inputs",
        })
    }
   
    //parse the signature
    const transaction=await connection.getTransaction(parsedBody.data.signature);

    console.log(transaction);

    if(((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) ) !== 100000000){
        return res.status(401).json({
            message:"transaction signature invalid",
        })
    }

    if(transaction?.transaction?.message?.getAccountKeys()?.get(1)?.toString() !==WALLET_ADDRESS){
        return res.status(401).json({
            message:"transaction signature invalid",
        })
    }

    if(transaction?.transaction?.message?.getAccountKeys()?.get(0)?.toString() !==user?.address){
        return res.status(401).json({
            message:"transaction signature invalid",
        })
    }

    const response = await prismaClient.$transaction(async tx => {
        const response = await tx.task.create({
            data: {
                title: parsedBody.data.title,
                signature: parsedBody.data.signature,
                user_id: userId,
                amount: 1*TOTAL_DECIMALS
            }
        })

        await tx.option.createMany({
            data: parsedBody.data.options.map(x => {
                return {
                    image_url: x.image_url,
                    task_id: response.id,
                }
            })
        })
        return response;
    })

    return res.status(201).json({
        id: response.id
    });


})




router.get('/presignedurl', authMiddleware, (req: CustomRequest, res) => {
    const userId = req.userId;
    //get the presigned url from the amazon s3 bucket or something else

    //send the url to the user
})

router.post('/signin', async (req, res) => {
    const signedString=new TextEncoder().encode("sign in and have some pizza with fizz");

    const {signature,publicKey} =req.body;


    const result=nacl.sign.detached.verify(
        signedString,
        new Uint8Array(signature.data),
        new PublicKey(publicKey).toBytes()
    )

    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: publicKey,
        }
    })
 
    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id,
        }, JWT_SECRET);


        return res.json({token});
    }
    else {

        const user = await prismaClient.user.create({
            data: {
                address: publicKey,
            }
        })
     

        const token = jwt.sign({
            userId: user.id,
        }, JWT_SECRET);

        return res.json({token});
    }
})

export default router;