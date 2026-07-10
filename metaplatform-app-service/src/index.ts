/**
 * metaplatform-app-service 入口
 * ────────────────────────────────────────────────────────────
 * 监听 PORT（默认 3002）；开发期通过 tsx watch 启动。
 */
import "dotenv/config";
import { createApp } from "./app";
import { config, SERVICE_VERSION } from "./config";

const app = createApp();
const port = config.port;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[metaplatform-app-service] ${SERVICE_VERSION} listening on http://localhost:${port}`,
  );
});
