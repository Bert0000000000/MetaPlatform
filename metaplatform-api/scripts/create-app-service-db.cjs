// 创建 app_service 数据库
const { Client } = require("pg");
const c = new Client({
  host: "localhost",
  port: 5432,
  user: "meta",
  password: "metaplatform",
  database: "postgres",
});
c.connect()
  .then(() => c.query("SELECT datname FROM pg_database WHERE datname IN ('app_service','metaplatform');"))
  .then((r) => {
    console.log("existing:", r.rows.map((x) => x.datname));
    return c.query("CREATE DATABASE app_service;");
  })
  .then(() => console.log("app_service created"))
  .catch((e) => console.log("ERR:", e.message))
  .finally(() => c.end());
