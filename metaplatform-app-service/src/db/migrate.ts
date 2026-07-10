/**
 * metaplatform-app-service 迁移执行器（CLI）
 * 跑：npm run migrate
 */
import "dotenv/config";
import { getDb, closeDb } from "./connection";

console.log("[migrate] starting ...");
getDb(); // 触发迁移
console.log("[migrate] done");
closeDb();
process.exit(0);
