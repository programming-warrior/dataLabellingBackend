"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = __importDefault(require("./routers/user"));
const worker_1 = __importDefault(require("./routers/worker"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
exports.JWT_SECRET = "a;leropqwyerqiwheriqwueryasd,fbkalsdf";
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/static', express_1.default.static(path_1.default.join(__dirname + '/../public/uploads')));
app.use("/v1/user", user_1.default);
app.use("/v1/worker", worker_1.default);
app.listen(8000, () => {
    console.log('server is listening on port 8000');
});
