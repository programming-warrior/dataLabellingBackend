"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const __1 = require("..");
const middleware_1 = require("../middleware");
const types_1 = require("../types");
const db_1 = require("../db");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const TOTAL_SUBMISSIONS = 100;
router.post('/payout', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    });
    if (!worker)
        return res.status(404).json({ message: "user not found" });
    //logic to send the money to the address using solana
    const address = worker.address;
    const txnId = "aperpqwer";
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount,
                },
                locked_amount: {
                    increment: worker.pending_amount,
                }
            }
        });
        yield tx.payout.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: txnId,
            }
        });
    }));
    return res.json({
        status: "processing",
        amount: worker.pending_amount,
    }).end();
}));
router.get('/balance', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId),
        },
        select: {
            pending_amount: true,
            locked_amount: true,
        }
    });
    if (!worker)
        return res.status(411).json({ message: "user id is invalid" }).end();
    return res.json({
        pendingAmount: worker.pending_amount,
        lockedAmount: worker.locked_amount
    }).end();
}));
router.post('/submission', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const parsedBody = types_1.createSubmissionInput.safeParse(req.body);
    if (!parsedBody.success)
        return res.status(411).json({ message: "invalid input" }).end();
    const task = yield (0, db_1.getNextTask)(Number(userId));
    if (!task || task.id != Number(parsedBody.data.taskId)) {
        return res.status(411).send({ message: "invalid task" }).end();
    }
    const amount = (task.amount / TOTAL_SUBMISSIONS);
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const submission = yield tx.submission.create({
            data: {
                option_id: Number(parsedBody.data.selection),
                worker_id: Number(userId),
                task_id: Number(parsedBody.data.taskId),
                amount,
            }
        });
        const workerUpadte = yield tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    increment: amount
                }
            }
        });
        console.log(workerUpadte);
        return submission;
    }));
    const nextTask = yield (0, db_1.getNextTask)(Number(userId));
    return res.status(201).json({
        amount,
        nextTask
    }).end();
}));
router.get('/nextTask', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const task = yield prismaClient.task.findFirst({
        where: {
            done: false,
            submission: {
                none: {
                    worker_id: Number(userId)
                }
            }
        },
        select: {
            title: true,
            option: true,
            id: true,
            amount: true,
        }
    });
    return res.json({ task }).end();
}));
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hardcodedWalletAddress = "a;hdsfialksdfladsoaher";
    const existingWorker = yield prismaClient.worker.findFirst({
        where: {
            address: hardcodedWalletAddress,
        }
    });
    if (existingWorker) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingWorker.id,
        }, __1.JWT_SECRET);
        return res.json(token);
    }
    else {
        const worker = yield prismaClient.worker.create({
            data: {
                address: hardcodedWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: worker.id,
        }, __1.JWT_SECRET);
        return res.json({ token });
    }
}));
exports.default = router;
