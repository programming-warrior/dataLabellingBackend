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
const client_1 = require("@prisma/client");
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const __1 = require("..");
const middleware_1 = require("../middleware");
const types_1 = require("../types");
const zod_1 = __importDefault(require("zod"));
const config_1 = require("../config");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const multer_1 = __importDefault(require("multer"));
const web3_js_1 = require("@solana/web3.js");
const connection = new web3_js_1.Connection("https://api.devnet.solana.com");
const WALLET_ADDRESS = "CUQWET53K6d51L8XnQ4L1HQb3ZUZ5xNSFafaXjoXofzB";
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, `${__dirname}/../../public/uploads`);
    },
    filename: function (req, file, cb) {
        if (file.mimetype == 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
            const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
            const fileType = file.originalname.split('.')[1];
            cb(null, req.userId + '-' + uniqueSuffix + '.' + fileType);
        }
        else {
            cb(new Error("file not supported"), "");
        }
    }
});
const upload = (0, multer_1.default)({ storage: storage });
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
router.post('/uploads', [middleware_1.authMiddleware, upload.single('file')], (req, res) => {
    var _a;
    res.json({
        "file": (_a = req.file) === null || _a === void 0 ? void 0 : _a.filename,
    }).end();
});
router.get('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = zod_1.default.string().safeParse(req.query.taskId);
    const userId = zod_1.default.number().safeParse(req.userId);
    if (!taskId.success || !userId.success)
        return res.status(411).json({ message: "invalid task id or user id" });
    const taskDetails = yield prismaClient.task.findFirst({
        where: {
            id: Number(taskId.data),
            user_id: Number(userId.data)
        },
        include: {
            option: true,
        }
    });
    if (!taskDetails) {
        return res.status(411).json({
            message: "you do not have access to the task"
        });
    }
    const responses = yield prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId.data)
        },
        include: {
            option: true,
        }
    });
    const result = {};
    taskDetails.option.forEach((option) => {
        result[option.id] = {
            count: 0,
            option: {
                image_url: option.image_url,
            }
        };
    });
    responses.forEach(r => {
        result[r.option_id].count++;
    });
    return res.status(200).json({ result, title: taskDetails.title }).end();
}));
router.post('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    // @ts-ignore
    const userId = parseInt(req.userId);
    const body = req.body;
    const parsedBody = types_1.createTaskInput.safeParse(body);
    const user = yield prismaClient.user.findFirst({
        where: {
            id: Number(req.userId),
        }
    });
    if (!parsedBody.success) {
        return res.status(411).json({
            message: "you have sent the wrong inputs",
        });
    }
    //parse the signature
    const transaction = yield connection.getTransaction(parsedBody.data.signature);
    console.log(transaction);
    if ((((_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _a === void 0 ? void 0 : _a.postBalances[1]) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _c === void 0 ? void 0 : _c.preBalances[1]) !== null && _d !== void 0 ? _d : 0)) !== 100000000) {
        return res.status(401).json({
            message: "transaction signature invalid",
        });
    }
    if (((_h = (_g = (_f = (_e = transaction === null || transaction === void 0 ? void 0 : transaction.transaction) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.getAccountKeys()) === null || _g === void 0 ? void 0 : _g.get(1)) === null || _h === void 0 ? void 0 : _h.toString()) !== WALLET_ADDRESS) {
        return res.status(401).json({
            message: "transaction signature invalid",
        });
    }
    if (((_m = (_l = (_k = (_j = transaction === null || transaction === void 0 ? void 0 : transaction.transaction) === null || _j === void 0 ? void 0 : _j.message) === null || _k === void 0 ? void 0 : _k.getAccountKeys()) === null || _l === void 0 ? void 0 : _l.get(0)) === null || _m === void 0 ? void 0 : _m.toString()) !== (user === null || user === void 0 ? void 0 : user.address)) {
        return res.status(401).json({
            message: "transaction signature invalid",
        });
    }
    const response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield tx.task.create({
            data: {
                title: parsedBody.data.title,
                signature: parsedBody.data.signature,
                user_id: userId,
                amount: 1 * config_1.TOTAL_DECIMALS
            }
        });
        yield tx.option.createMany({
            data: parsedBody.data.options.map(x => {
                return {
                    image_url: x.image_url,
                    task_id: response.id,
                };
            })
        });
        return response;
    }));
    return res.status(201).json({
        id: response.id
    });
}));
router.get('/presignedurl', middleware_1.authMiddleware, (req, res) => {
    const userId = req.userId;
    //get the presigned url from the amazon s3 bucket or something else
    //send the url to the user
});
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const signedString = new TextEncoder().encode("sign in and have some pizza with fizz");
    const { signature, publicKey } = req.body;
    const result = tweetnacl_1.default.sign.detached.verify(signedString, new Uint8Array(signature.data), new web3_js_1.PublicKey(publicKey).toBytes());
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: publicKey,
        }
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id,
        }, __1.JWT_SECRET);
        return res.json({ token });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: publicKey,
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
        }, __1.JWT_SECRET);
        return res.json({ token });
    }
}));
exports.default = router;
