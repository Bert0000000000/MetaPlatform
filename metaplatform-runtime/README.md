# metaplatform-runtime

独立运行的镜像 —— 每个发布的 MetaPlatform 应用都跑在自己一个容器里，
互不依赖主平台进程。

镜像内容：
- 极简 Node.js Express，只对外提供只读 API。
- 只挂载该应用专属的 sqlite 文件 `/data/app.db` (ro)。
- 不访问任何外部服务（无 Kafka / Redis / Postgres / Flowable）。
- 资源隔离：CPU/内存限额、只读 rootfs、tmpfs /tmp、非 root 用户、
  no-new-privileges。

构建：

```bash
docker build -t metaplatform-runtime:v1 ./metaplatform-runtime
```

入口由 orchestrator 调度；不要直接手动跑。
