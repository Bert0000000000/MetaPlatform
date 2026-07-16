import os
import subprocess

OUT_DIR = r"c:\Users\houuu\.trae-cn\work\6a57afd9ba92720d9a267a80\diagrams"
os.makedirs(OUT_DIR, exist_ok=True)

def render(name, dot):
    path = os.path.join(OUT_DIR, name)
    with open(path + ".dot", "w", encoding="utf-8") as f:
        f.write(dot)
    subprocess.run(["dot", "-Tpng", path + ".dot", "-o", path + ".png", "-Gdpi=150"], check=True)
    print(f"Generated {path}.png")

# Application architecture
app_arch = """
digraph G {
    rankdir=TB;
    node [shape=box, style="rounded,filled", fontname="Microsoft YaHei", fontsize=12];
    edge [fontname="Microsoft YaHei", fontsize=10, color="#666666"];

    subgraph cluster_user {
        label="用户触点层";
        style=filled;
        color="#E8F4FD";
        portal [label="应用门户 / 工作台", fillcolor="#D0E8F7"];
        copilot [label="数字员工 / Copilot", fillcolor="#D0E8F7"];
        ide [label="AI 开发工具 (Cloud Code / Codex)", fillcolor="#D0E8F7"];
    }

    subgraph cluster_app {
        label="应用构建层";
        style=filled;
        color="#FFF4E6";
        lc [label="低代码 / 零代码应用构建器", fillcolor="#FFE4C2"];
        ai_dev [label="AI 辅助开发 (CRI / MCP)", fillcolor="#FFE4C2"];
        app_market [label="应用市场 / 模板中心", fillcolor="#FFE4C2"];
    }

    subgraph cluster_core {
        label="平台核心能力层";
        style=filled;
        color="#E8F8E8";
        onto [label="Ontology 本体引擎", fillcolor="#C2F0C2"];
        kg [label="知识图谱引擎", fillcolor="#C2F0C2"];
        workflow [label="流程引擎 / BPM", fillcolor="#C2F0C2"];
        action [label="Action 动作引擎", fillcolor="#C2F0C2"];
        rag [label="企业级 RAG 知识库", fillcolor="#C2F0C2"];
        rag2 [label="结构化知识库 (非向量)", fillcolor="#C2F0C2"];
        integration [label="数据集成 / Data Fabric", fillcolor="#C2F0C2"];
        ai_svc [label="AI 服务层 (LLM Gateway / Agent)", fillcolor="#C2F0C2"];
        ea [label="企业 EA 架构资产", fillcolor="#C2F0C2"];
    }

    subgraph cluster_foundation {
        label="基础设施层";
        style=filled;
        color="#F3E8F8";
        db [label="元数据 / 图 / 向量 / 对象存储", fillcolor="#E5D1F2"];
        bus [label="事件总线 / 消息队列", fillcolor="#E5D1F2"];
        iam [label="身份与访问控制 (IAM)", fillcolor="#E5D1F2"];
        api_gw [label="Open API 网关", fillcolor="#E5D1F2"];
    }

    portal -> lc;
    copilot -> ai_svc;
    ide -> ai_dev;
    lc -> onto;
    lc -> workflow;
    ai_dev -> ai_svc;
    app_market -> lc;
    onto -> kg;
    onto -> workflow [style=dashed, label="约束与建模"];
    workflow -> action [label="触发"];
    onto -> action;
    rag -> kg;
    rag2 -> kg;
    integration -> db;
    ai_svc -> onto;
    ai_svc -> rag;
    ai_svc -> rag2;
    ai_svc -> workflow;
    action -> integration;
    onto -> db;
    kg -> db;
    action -> bus;
    ai_svc -> api_gw;
    ea -> onto [style=dashed, label="对齐"];
    ea -> workflow [style=dashed, label="流程资产"];
}
"""
render("application_architecture", app_arch)

# Technical architecture
tech_arch = """
digraph G {
    rankdir=TB;
    node [shape=box, style="rounded,filled", fontname="Microsoft YaHei", fontsize=12];
    edge [fontname="Microsoft YaHei", fontsize=10, color="#666666"];

    subgraph cluster_front {
        label="前端技术栈";
        color="#E8F4FD";
        style=filled;
        web [label="React / Vue 门户与构建器", fillcolor="#D0E8F7"];
        mobile [label="移动端 / 小程序", fillcolor="#D0E8F7"];
        chat [label="Copilot Chat UI", fillcolor="#D0E8F7"];
    }

    subgraph cluster_back {
        label="后端服务层";
        color="#FFF4E6";
        style=filled;
        svc_onto [label="Ontology Service\n(Java/Go/Python)", fillcolor="#FFE4C2"];
        svc_app [label="App Builder Service\n(Node/Java)", fillcolor="#FFE4C2"];
        svc_workflow [label="Workflow Service\n(Java/Go)", fillcolor="#FFE4C2"];
        svc_data [label="Data Integration Service\n(Python/Go)", fillcolor="#FFE4C2"];
        svc_ai [label="AI Service\n(Python)", fillcolor="#FFE4C2"];
        svc_action [label="Action Engine Service\n(Java/Go)", fillcolor="#FFE4C2"];
        svc_ea [label="EA Service\n(Java/Go)", fillcolor="#FFE4C2"];
    }

    subgraph cluster_engine {
        label="通用引擎";
        color="#E8F8E8";
        style=filled;
        e_onto [label="本体建模与推理引擎", fillcolor="#C2F0C2"];
        e_bpmn [label="BPMN 流程引擎", fillcolor="#C2F0C2"];
        e_rule [label="规则 / 决策引擎", fillcolor="#C2F0C2"];
        e_rag [label="RAG 检索与生成引擎", fillcolor="#C2F0C2"];
        e_etl [label="ETL / CDC / 数据质量引擎", fillcolor="#C2F0C2"];
        e_agent [label="Agent 规划与执行引擎", fillcolor="#C2F0C2"];
        e_ea [label="EA 架构资产管理引擎", fillcolor="#C2F0C2"];
    }

    subgraph cluster_data {
        label="数据层";
        color="#F3E8F8";
        style=filled;
        pg [label="PostgreSQL / MySQL\n元数据", fillcolor="#E5D1F2"];
        neo [label="Neo4j / JanusGraph\n知识图谱", fillcolor="#E5D1F2"];
        milvus [label="Milvus / PGVector\n向量库", fillcolor="#E5D1F2"];
        minio [label="MinIO / S3\n对象存储", fillcolor="#E5D1F2"];
        lake [label="Data Lake\n(Parquet/Iceberg)", fillcolor="#E5D1F2"];
    }

    subgraph cluster_infra {
        label="基础设施";
        color="#FCE8E6";
        style=filled;
        k8s [label="Kubernetes", fillcolor="#F7C9C6"];
        mq [label="Kafka / RabbitMQ", fillcolor="#F7C9C6"];
        redis [label="Redis / KeyDB", fillcolor="#F7C9C6"];
        obs [label="Observability", fillcolor="#F7C9C6"];
    }

    web -> svc_app;
    mobile -> svc_app;
    chat -> svc_ai;
    svc_app -> e_onto;
    svc_app -> e_bpmn;
    svc_app -> e_rule;
    svc_onto -> e_onto;
    svc_workflow -> e_bpmn;
    svc_workflow -> e_rule;
    svc_ea -> e_ea;
    svc_data -> e_etl;
    svc_ai -> e_rag;
    svc_ai -> e_agent;
    svc_action -> e_bpmn;
    svc_action -> e_rule;
    e_onto -> neo;
    e_ea -> neo;
    e_bpmn -> pg;
    e_rule -> pg;
    e_rag -> milvus;
    e_rag -> neo;
    e_etl -> lake;
    e_agent -> pg;
    svc_app -> pg;
    svc_data -> pg;
    svc_ai -> redis;
    svc_action -> mq;
    svc_workflow -> mq;
    k8s -> svc_onto [style=dashed];
}
"""
render("technical_architecture", tech_arch)

# Data flow diagram
data_flow = """
digraph G {
    rankdir=LR;
    node [shape=box, style="rounded,filled", fontname="Microsoft YaHei", fontsize=12];
    edge [fontname="Microsoft YaHei", fontsize=10, color="#666666"];

    src [label="外部数据源\nERP / CRM / OA / API / 文件", fillcolor="#D0E8F7"];
    extract [label="抽取与集成\nCDC / ETL / API 连接器", fillcolor="#FFE4C2"];
    struct [label="结构化数据\n实体 / 属性 / 关系", fillcolor="#C2F0C2"];
    doc [label="非结构化知识\n制度 / 流程 / 访谈", fillcolor="#C2F0C2"];
    onto [label="Ontology 本体引擎\n建模 / 推理 / 校验", fillcolor="#E5D1F2"];
    kg [label="企业知识图谱\n语义网络", fillcolor="#E5D1F2"];
    rag [label="RAG 检索\n向量 + 非向量混合", fillcolor="#E5D1F2"];
    action [label="Action Engine\n决策建议 / 自动化执行", fillcolor="#F7C9C6"];
    app [label="业务应用\n表单 / 流程 / 报表", fillcolor="#D0E8F7"];

    src -> extract;
    extract -> struct;
    extract -> doc;
    struct -> onto;
    doc -> onto;
    onto -> kg;
    doc -> rag;
    kg -> rag;
    kg -> action;
    rag -> action;
    workflow [label="流程引擎\nBPMN / 规则", fillcolor="#FFE4C2"];
    onto -> workflow [style=dashed, label="流程定义"];
    workflow -> action [label="触发"];
    action -> app;
    app -> extract [style=dashed, label="业务数据回流"];
    app -> workflow [style=dashed, label="流程发起"];
}
"""
render("data_flow", data_flow)

# Enterprise Architecture diagram
enterprise_arch = """
digraph G {
    rankdir=TB;
    node [shape=box, style="rounded,filled", fontname="Microsoft YaHei", fontsize=12];
    edge [fontname="Microsoft YaHei", fontsize=10, color="#666666"];

    subgraph cluster_strategy {
        label="战略层";
        color="#E8F4FD";
        style=filled;
        goal [label="企业战略 / 业务目标", fillcolor="#D0E8F7"];
        kpi [label="KPI / OKR", fillcolor="#D0E8F7"];
    }

    subgraph cluster_business {
        label="业务架构 (Business Architecture)";
        color="#FFF4E6";
        style=filled;
        capability [label="业务能力地图\nCapability Map", fillcolor="#FFE4C2"];
        process [label="业务流程 / BPMN", fillcolor="#FFE4C2"];
        org [label="组织与角色", fillcolor="#FFE4C2"];
        value [label="价值链 / Value Stream", fillcolor="#FFE4C2"];
    }

    subgraph cluster_app {
        label="应用架构 (Application Architecture)";
        color="#E8F8E8";
        style=filled;
        app_portfolio [label="应用组合\nApplication Portfolio", fillcolor="#C2F0C2"];
        app_builder [label="低代码构建器\nApp Builder", fillcolor="#C2F0C2"];
        integration [label="集成与 API 网关", fillcolor="#C2F0C2"];
    }

    subgraph cluster_data {
        label="数据架构 (Data Architecture)";
        color="#F3E8F8";
        style=filled;
        ontology [label="Ontology 本体模型", fillcolor="#E5D1F2"];
        kg [label="企业知识图谱", fillcolor="#E5D1F2"];
        data_catalog [label="数据目录 / 血缘", fillcolor="#E5D1F2"];
    }

    subgraph cluster_tech {
        label="技术架构 (Technology Architecture)";
        color="#FCE8E6";
        style=filled;
        platform [label="Mate Platform 技术平台", fillcolor="#F7C9C6"];
        infra [label="云原生基础设施", fillcolor="#F7C9C6"];
        security [label="安全与合规", fillcolor="#F7C9C6"];
    }

    goal -> capability;
    kpi -> value;
    capability -> process;
    process -> app_portfolio;
    org -> app_portfolio;
    value -> process;
    app_portfolio -> ontology [style=dashed, label="语义对齐"];
    app_builder -> app_portfolio;
    integration -> app_portfolio;
    ontology -> kg;
    ontology -> data_catalog;
    kg -> data_catalog;
    app_portfolio -> platform;
    integration -> platform;
    ontology -> platform;
    kg -> platform;
    platform -> infra;
    platform -> security;
}
"""
render("enterprise_architecture", enterprise_arch)

# Workflow engine detail
workflow_detail = """
digraph G {
    rankdir=TB;
    node [shape=box, style="rounded,filled", fontname="Microsoft YaHei", fontsize=12];
    edge [fontname="Microsoft YaHei", fontsize=10, color="#666666"];

    model [label="流程建模\nBPMN / 低代码设计器", fillcolor="#D0E8F7"];
    repository [label="流程仓库\n版本 / 分类 / 权限", fillcolor="#FFE4C2"];
    runtime [label="流程运行时\n状态机 / 任务调度", fillcolor="#C2F0C2"];
    rule [label="规则引擎\nDMN / 业务规则", fillcolor="#C2F0C2"];
    task [label="任务中心\n待办 / 会签 / 委托", fillcolor="#C2F0C2"];
    action [label="Action Engine\n自动化执行 / RPA", fillcolor="#E5D1F2"];
    monitor [label="流程监控\nSLA / 瓶颈 / 热力图", fillcolor="#F7C9C6"];
    ontology [label="Ontology 本体引擎", fillcolor="#E8F8E8"];

    model -> repository;
    repository -> runtime;
    runtime -> task;
    runtime -> rule;
    runtime -> action;
    runtime -> monitor;
    ontology -> model [style=dashed, label="概念与角色"];
    ontology -> rule [style=dashed, label="约束与推导"];
    task -> action [style=dashed, label="人工节点触发"];
}
"""
render("workflow_engine", workflow_detail)

print("All diagrams generated.")
