import { Router, Response, Request } from "express"
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { JWT_SECRET } from "..";
import { authMiddleware } from "../middleware";
import { createSubmissionInput } from "../types";
import { getNextTask } from "../db";
import { TOTAL_DECIMALS } from "../config";

const router = Router();

const prismaClient = new PrismaClient();

interface CustomRequest extends Request {
    userId?: string;
}

const TOTAL_SUBMISSIONS = 100;

router.post('/payout',authMiddleware,async(req:CustomRequest,res)=>{
    const userId=req.userId;
    const worker=await prismaClient.worker.findFirst({
        where:{
            id:Number(userId)
        }
    })

    if(!worker) return res.status(404).json({message:"user not found"});

    
    //logic to send the money to the address using solana

    const address=worker.address;

    const txnId="aperpqwer"

    await prismaClient.$transaction(async(tx)=>{
        await tx.worker.update({
            where:{
                id:Number(userId)
            },
            data:{
                pending_amount:{
                    decrement:worker.pending_amount,
                },
                locked_amount:{
                    increment:worker.pending_amount,
                }
            }
        })

        await tx.payout.create({
          data:{
            user_id:Number(userId),
            amount:worker.pending_amount,
            status:"Processing",
            signature:txnId,
          }  
        })

    })

    return res.json({
        status:"processing",
        amount:worker.pending_amount,
    }).end();
})

router.get('/balance', authMiddleware, async(req: CustomRequest, res) => {
    const userId = req.userId;
    const worker =await prismaClient.worker.findFirst({
        where: {
            id: Number(userId),
        },
        select: {
            pending_amount: true,
            locked_amount: true,
        }
    })
    if (!worker) return res.status(411).json({ message: "user id is invalid" }).end();


    return res.json({
        pendingAmount: worker.pending_amount,
        lockedAmount: worker.locked_amount
    }).end()
})

router.post('/submission', authMiddleware, async (req: CustomRequest, res) => {
    const userId = req.userId;
    const parsedBody = createSubmissionInput.safeParse(req.body);

    if (!parsedBody.success) return res.status(411).json({ message: "invalid input" }).end();

    const task = await getNextTask(Number(userId)); 

    if (!task || task.id != Number(parsedBody.data.taskId)) {
        return res.status(411).send({ message: "invalid task" }).end();
    }


    const amount = (task.amount / TOTAL_SUBMISSIONS);

    await prismaClient.$transaction(async tx => {
        const submission = await tx.submission.create({
            data: {
                option_id: Number(parsedBody.data.selection),
                worker_id: Number(userId),
                task_id: Number(parsedBody.data.taskId),
                amount,
            }
        })
        const workerUpadte = await tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    increment: amount
                }
            }
        })
        console.log(workerUpadte);

        return submission;
    })



    const nextTask = await getNextTask(Number(userId));

    return res.status(201).json({
        amount,
        nextTask
    }).end();

})

router.get('/nextTask', authMiddleware, async (req: CustomRequest, res) => {
    const userId = req.userId;

    const task = await prismaClient.task.findFirst({
        where: {
            done: false,
            submission: {
                none: {
                    worker_id: Number(userId)
                }
            }
        },
       select:{
            title:true,
            option:true,
            id:true,
            amount:true,
       }
    })



    return res.json({ task }).end();

})

router.post('/signin', async (req: CustomRequest, res) => {
    const hardcodedWalletAddress = "a;hdsfialksdfladsoaher";

    const existingWorker = await prismaClient.worker.findFirst({
        where: {
            address: hardcodedWalletAddress,
        }
    })
    if (existingWorker) {
        const token = jwt.sign({
            userId: existingWorker.id,
        }, JWT_SECRET);


        return res.json(token);
    }
    else {
        const worker = await prismaClient.worker.create({
            data: {
                address: hardcodedWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        })

        const token = jwt.sign({
            userId: worker.id,
        }, JWT_SECRET);

        return res.json({ token });
    }
})

export default router;