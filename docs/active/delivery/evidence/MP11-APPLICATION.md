# MetaPlatform 1.1 应用中心证据

任务6限定验收通过，源代码范围fc199803..0f68c3d8；实现ae9ab8ff、修复e6eb1564及0f68c3d8。初审六项Important均已修复；第一轮复审发现的合法edit-set回执遗漏已在第二轮关闭。最终限定复审无Critical/Important/新增Minor；继承警告继续由任务8记录和处理。本记录不表示完整1.1候选版或正式发布通过。

现在可以从实际业务分组创建应用与订单页面，选择保存的Order/Customer/关系和Action绑定，读取真实对象集合、预览、保存，再发布持久快照。发布前展示六项实际检查和可处理的失败/未知项；最终发布再次检查。草稿版本与运行版本独立，元数据编辑不改变当前运行快照；再次发布和回滚均选择实际持久版本。

订单审核沿用Proposal确认与执行。应用历史由同租户、实际加载的发布快照/page/Action归属过滤，不依赖订单继续留在筛选集合。普通Action和两种合法edit-set入口执行后、对象退出集合及API新进程恢复，仍找到同一审计回执。外部伪造app/page/version或以custom edits替换绑定Action会拒绝；归属表示经验证的应用绑定关联，不证明请求来自浏览器。

应用按返回ID删除会核验实际删除结果。新建应用、模块与页面使用租户隔离的create-only语义；重复或并发创建返回冲突，保留已有内容与旧ID。SQL发布CAS拒绝陈旧更新；声明式数据库执行以既有锁、幂等键和事务持久化回执。并发/新进程证据针对实际PG声明式编辑，不宣称外部函数副作用在崩溃下恰好一次。

| 验证范围 | 实际结果 | 证据界限 |
|---|---|---|
| e6eb1564修复后的AppHub及直接关联edit-set测试 | 227 passed，0 skip，79 warnings | 4项实际PG；fixture鉴权，不是签名issuer验收 |
| e6eb1564前端7个受影响文件 | 33 passed | 包含实际引用/未知拒绝与发布检查/版本/历史组件 |
| e6eb1564真实浏览器/API/PG | 3 passed，16.2s | 保存失败、发布未知/重试、筛选后重开原回执、引导恢复；trace/video关闭 |
| e6eb1564类型与构建 | tsc退出0；Vite退出0/31.26s | 后续只改测试及后端/契约，未重复未变的构建 |
| 0f68c3d8最终专项测试 | 34 passed，0 skip，1继承warning，8.35s | 包含action/edit_set历史、独立Python恢复、并发创建及endTime字段 |
| 0f68c3d8实际HTTP/PG别名执行与API重启 | 两合法入口退出ObjectSet后原audit恢复 | forged/custom-edit仍拒绝；仍为signature-bypass USER fixture |
| canonical | AppHub38/Ont9操作，metadata/ref错误0；Fix2仅endTime声明变化 | 实际COMPLETED样本加显式字段检查；未把宽松schema校验当字段准确证明 |
| migration | 真正新库到0021、真正0020升级到0021、旧行/快照/CAS及独立进程检查通过 | Fix2无迁移变化，历史迁移证据未重标为新运行 |

专项命令为项目Python执行packages/mate-app-hub/tests/test_apphub_order_binding.py，-q -p no:cacheprovider --tb=short。写测试显式指向127.0.0.1:55497及codex_mp11_数据库；凭据通过受保护的本地输入传入，未归档。历史完整命令、RED/GREEN、审查与脱敏JSON位于[执行报告](mp11-application/task-6-report.md)、[第二轮复审](mp11-application/task-6-rereview2.md)及同目录证据。不同源代码范围的次数不相加为整体候选版验收。

当前独立fixture API55510和Vite9367保留供任务7/8复用，操作前以资源账本和OS身份核验为准；历史PID不构成持续运行保证。用户预览9200/官网9361及原有Docker镜像保留。服务器批准期限由任务7完成；真实签名人类/服务账户分类、实际登录、全链故障/恢复及可启动候选部署由任务8完成。正式域名发布、72小时SLO和真实dsh/WorkBuddy客户端不在本次限定验收结果内。