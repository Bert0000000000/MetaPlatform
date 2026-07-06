/**
 * /api/export — Code Export Engine
 * Generates deployable code packages from app definitions and ontology models.
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════

/** Convert a name to PascalCase */
function toPascalCase(str) {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/** Convert a name to camelCase */
function toCamelCase(str) {
  const p = toPascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Convert a name to kebab-case */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/** Map ontology property type to Java type */
function propTypeToJava(type) {
  const map = {
    text: "String",
    textarea: "String",
    number: "Long",
    integer: "Long",
    decimal: "BigDecimal",
    float: "Double",
    double: "Double",
    boolean: "Boolean",
    date: "LocalDate",
    datetime: "LocalDateTime",
    time: "LocalTime",
    email: "String",
    phone: "String",
    url: "String",
    select: "String",
    multiselect: "String",
    file: "String",
    image: "String",
    json: "String",
    rich_text: "String",
    auto_increment: "Long",
    uuid: "String",
    created_at: "LocalDateTime",
    updated_at: "LocalDateTime",
  };
  return map[type] || "String";
}

/** Map ontology property type to TypeScript type */
function propTypeToTS(type) {
  const map = {
    text: "string",
    textarea: "string",
    number: "number",
    integer: "number",
    decimal: "number",
    float: "number",
    double: "number",
    boolean: "boolean",
    date: "string",
    datetime: "string",
    time: "string",
    email: "string",
    phone: "string",
    url: "string",
    select: "string",
    multiselect: "string[]",
    file: "string",
    image: "string",
    json: "Record<string, unknown>",
    rich_text: "string",
    auto_increment: "number",
    uuid: "string",
    created_at: "string",
    updated_at: "string",
  };
  return map[type] || "string";
}

/** Map ontology property type to SQL column type */
function propTypeToSQL(type) {
  const map = {
    text: "VARCHAR(255)",
    textarea: "TEXT",
    number: "BIGINT",
    integer: "BIGINT",
    decimal: "DECIMAL(19,4)",
    float: "DOUBLE PRECISION",
    double: "DOUBLE PRECISION",
    boolean: "BOOLEAN",
    date: "DATE",
    datetime: "TIMESTAMP",
    time: "TIME",
    email: "VARCHAR(255)",
    phone: "VARCHAR(50)",
    url: "VARCHAR(512)",
    select: "VARCHAR(100)",
    multiselect: "TEXT",
    file: "VARCHAR(512)",
    image: "VARCHAR(512)",
    json: "JSONB",
    rich_text: "TEXT",
    auto_increment: "BIGSERIAL",
    uuid: "UUID",
    created_at: "TIMESTAMP",
    updated_at: "TIMESTAMP",
  };
  return map[type] || "VARCHAR(255)";
}

/** Map ontology property type to JPA column annotation extra */
function jpaColumnExtras(prop) {
  const extras = [];
  if (prop.type === "text" || prop.type === "email" || prop.type === "phone") {
    extras.push(`length = 255`);
  }
  if (prop.type === "textarea" || prop.type === "rich_text") {
    extras.push(`columnDefinition = "TEXT"`);
  }
  if (!prop.required) {
    extras.push(`nullable = true`);
  }
  return extras.length ? `, ${extras.join(", ")}` : "";
}

// ════════════════════════════════════════════════════════
//  Generator: Vue 3 + Vite
// ════════════════════════════════════════════════════════

function generateVueTarget(app, pages, objectsWithProps) {
  const files = [];
  const appName = app.name || "MetaPlatform App";
  const appKebab = toKebabCase(appName);

  // ── package.json ──
  files.push({
    name: "frontend/package.json",
    type: "json",
    content: JSON.stringify({
      name: `${appKebab}-frontend`,
      version: app.version || "1.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vue-tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        vue: "^3.5.0",
        "vue-router": "^4.4.0",
        pinia: "^2.2.0",
        axios: "^1.7.0",
        "element-plus": "^2.8.0",
        "@element-plus/icons-vue": "^2.3.0",
      },
      devDependencies: {
        "@vitejs/plugin-vue": "^5.1.0",
        typescript: "^5.5.0",
        vite: "^5.4.0",
        "vue-tsc": "^2.1.0",
      },
    }, null, 2),
  });

  // ── vite.config.ts ──
  files.push({
    name: "frontend/vite.config.ts",
    type: "typescript",
    content: `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
`,
  });

  // ── tsconfig.json ──
  files.push({
    name: "frontend/tsconfig.json",
    type: "json",
    content: JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        jsx: "preserve",
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        skipLibCheck: true,
        noEmit: true,
        paths: { "@/*": ["./src/*"] },
        baseUrl: ".",
      },
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      references: [{ path: "./tsconfig.node.json" }],
    }, null, 2),
  });

  // ── index.html ──
  files.push({
    name: "frontend/index.html",
    type: "html",
    content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  });

  // ── src/main.ts ──
  files.push({
    name: "frontend/src/main.ts",
    type: "typescript",
    content: `import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.mount("#app");
`,
  });

  // ── src/App.vue ──
  files.push({
    name: "frontend/src/App.vue",
    type: "vue",
    content: `<template>
  <el-config-provider :locale="zhCn">
    <el-container class="app-container">
      <el-aside width="220px" class="app-aside">
        <div class="logo">
          <h2>${appName}</h2>
        </div>
        <el-menu :default-active="route.path" router>
${pages.map((p) => `          <el-menu-item index="/${toKebabCase(p.name)}">
            <el-icon><component :is="'${p.icon || "Document"}'" /></el-icon>
            <span>${p.name}</span>
          </el-menu-item>`).join("\n")}
        </el-menu>
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-config-provider>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import zhCn from "element-plus/es/locale/lang/zh-cn";

const route = useRoute();
</script>

<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.app-container { height: 100vh; }
.app-aside { background: #001529; overflow-y: auto; }
.app-aside .logo { padding: 16px; text-align: center; color: #fff; }
.app-aside .el-menu { border-right: none; background: #001529; }
.app-aside .el-menu-item { color: #ffffffb3; }
.app-aside .el-menu-item.is-active { color: #409eff; }
</style>
`,
  });

  // ── src/router/index.ts ──
  const routeImports = pages.map((p) => {
    const compName = toPascalCase(p.name);
    return `import ${compName}View from "../views/${compName}View.vue";`;
  }).join("\n");

  const routeDefs = pages.map((p) => {
    const compName = toPascalCase(p.name);
    return `    { path: "/${toKebabCase(p.name)}", name: "${compName}", component: ${compName}View },`;
  }).join("\n");

  files.push({
    name: "frontend/src/router/index.ts",
    type: "typescript",
    content: `import { createRouter, createWebHistory } from "vue-router";
${routeImports}

const router = createRouter({
  history: createWebHistory(),
  routes: [
${routeDefs}
    { path: "/", redirect: "${pages.length > 0 ? "/" + toKebabCase(pages[0].name) : "/"}" },
  ],
});

// ════════════════════════════════════════════════════════
//  GET /download/:appId — Download all generated files by app
// ════════════════════════════════════════════════════════

router.get("/download/:appId", (req, res, next) => {
  try {
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.appId);
    if (!app) {
      return res.status(404).json({ success: false, error: "应用不存在" });
    }

    // Read app pages
    const pages = db.prepare(
      "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(req.params.appId);

    // Read ontology objects with properties
    const objects = db.prepare(
      "SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at ASC"
    ).all(req.params.appId);

    const objectsWithProps = objects.map((obj) => {
      const properties = db.prepare(
        "SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order"
      ).all(obj.id);
      return { ...obj, properties };
    });

    // Generate all file categories
    const frontendFiles = generateVueTarget(app, pages, objectsWithProps);
    const backendFiles = generateSpringTarget(app, objectsWithProps);
    const databaseFiles = generateDdlTarget(app, objectsWithProps);
    const deployFiles = generateDockerTarget(app);

    const allFiles = [...frontendFiles, ...backendFiles, ...databaseFiles, ...deployFiles];

    if (allFiles.length === 0) {
      return res.status(404).json({ success: false, error: "应用没有可导出的内容" });
    }

    res.json({
      success: true,
      data: {
        frontend: frontendFiles,
        backend: backendFiles,
        database: databaseFiles,
        deploy: deployFiles,
        app: { id: app.id, name: app.name, version: app.version },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
`,
  });

  // ── src/api/index.ts ──
  files.push({
    name: "frontend/src/api/index.ts",
    type: "typescript",
    content: `import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error("[API Error]", err.response?.data || err.message);
    return Promise.reject(err);
  },
);

export default api;
`,
  });

  // ── src/types/index.ts (from ontology objects) ──
  const typeDefs = objectsWithProps.map((obj) => {
    const fields = (obj.properties || []).map((p) => {
      const tsType = propTypeToTS(p.type);
      return `  ${p.name}${p.required ? "" : "?"}: ${tsType};`;
    }).join("\n");
    return `export interface ${toPascalCase(obj.name)} {\n  id: string;\n${fields}\n  created_at?: string;\n  updated_at?: string;\n}`;
  }).join("\n\n");

  files.push({
    name: "frontend/src/types/index.ts",
    type: "typescript",
    content: `/**
 * Auto-generated types from ontology model
 */
${typeDefs}
`,
  });

  // ── src/api/services (one per ontology object) ──
  objectsWithProps.forEach((obj) => {
    const name = toPascalCase(obj.name);
    const nameKebab = toKebabCase(obj.name);
    files.push({
      name: `frontend/src/api/${nameKebab}.ts`,
      type: "typescript",
      content: `import api from "./index";
import type { ${name} } from "../types";

export const ${toCamelCase(obj.name)}Api = {
  list: () => api.get<any, ${name}[]>("/${nameKebab}"),
  get: (id: string) => api.get<any, ${name}>(\`/${nameKebab}/\${id}\`),
  create: (data: Partial<${name}>) => api.post<any, ${name}>("/${nameKebab}", data),
  update: (id: string, data: Partial<${name}>) => api.put<any, ${name}>(\`/${nameKebab}/\${id}\`, data),
  delete: (id: string) => api.delete(\`/${nameKebab}/\${id}\`),
};
`,
    });
  });

  // ── View components (one per page) ──
  pages.forEach((page) => {
    const compName = toPascalCase(page.name);
    const pageType = page.type || "list";

    let template = "";
    let scriptExtra = "";

    if (pageType === "list") {
      // Try to find related ontology object
      const relatedObj = objectsWithProps[0]; // fallback to first
      const columns = relatedObj
        ? (relatedObj.properties || []).slice(0, 6).map((p) => p)
        : [];
      const tableName = relatedObj ? toKebabCase(relatedObj.name) : toKebabCase(page.name);

      template = `<template>
  <div class="${toKebabCase(page.name)}-view">
    <div class="page-header">
      <h2>${page.name}</h2>
      <el-button type="primary" @click="handleCreate">新增</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" stripe>
${columns.map((c) => `      <el-table-column prop="${c.name}" label="${c.label}" />`).join("\n")}
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="formData" label-width="100px">
${columns.map((c) => `        <el-form-item label="${c.label}">
          <el-input v-model="formData.${c.name}" />
        </el-form-item>`).join("\n")}
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>`;

      scriptExtra = `
const tableData = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const dialogTitle = ref("新增");
const formData = reactive<Record<string, any>>({});
const editId = ref<string | null>(null);

async function fetchData() {
  loading.value = true;
  try {
    const res = await api.get("/${tableName}");
    tableData.value = Array.isArray(res) ? res : (res as any).data || [];
  } catch (err) {
    console.error("Failed to fetch data:", err);
  } finally {
    loading.value = false;
  }
}

function handleCreate() {
  editId.value = null;
  dialogTitle.value = "新增";
  Object.keys(formData).forEach((key) => delete formData[key]);
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑";
  Object.keys(formData).forEach((key) => delete formData[key]);
  Object.assign(formData, row);
  dialogVisible.value = true;
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除这条记录吗？", "确认删除", { type: "warning" });
    await api.delete(\`/${tableName}/\${row.id}\`);
    ElMessage.success("删除成功");
    fetchData();
  } catch (e: any) {
    if (e !== "cancel") ElMessage.error("删除失败");
  }
}

async function handleSubmit() {
  try {
    if (editId.value) {
      await api.put(\`/${tableName}/\${editId.value}\`, { ...formData });
      ElMessage.success("更新成功");
    } else {
      await api.post("/${tableName}", { ...formData });
      ElMessage.success("新增成功");
    }
    dialogVisible.value = false;
    fetchData();
  } catch (e) {
    ElMessage.error("操作失败");
  }
}

onMounted(fetchData);`;
    } else if (pageType === "form") {
      template = `<template>
  <div class="${toKebabCase(page.name)}-view">
    <h2>${page.name}</h2>
    <el-form :model="form" label-width="120px" class="form-container">
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit">提交</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>`;
      scriptExtra = `
const form = reactive({ name: "", description: "" });

async function handleSubmit() {
  try {
    await api.post("/${toKebabCase(page.name)}", { ...form });
    ElMessage.success("提交成功");
  } catch (err) {
    ElMessage.error("提交失败");
  }
}

function handleReset() {
  form.name = "";
  form.description = "";
}`;
    } else {
      // dashboard or custom
      template = `<template>
  <div class="${toKebabCase(page.name)}-view">
    <h2>${page.name}</h2>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>统计卡片</template>
          <div class="stat-value">--</div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>图表区域</template>
          <div style="height: 300px; display: flex; align-items: center; justify-content: center; color: #999;">
            Dashboard Chart Placeholder
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>`;
      scriptExtra = "";
    }

    const imports = [];
    if (pageType === "list") {
      imports.push(`import { ElMessage, ElMessageBox } from "element-plus";`);
      imports.push(`import api from "@/api";`);
    } else if (pageType === "form") {
      imports.push(`import { ElMessage } from "element-plus";`);
      imports.push(`import api from "@/api";`);
    }

    files.push({
      name: `frontend/src/views/${compName}View.vue`,
      type: "vue",
      content: `${template}

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
${imports.join("\n")}
${scriptExtra}
</script>

<style scoped>
.${toKebabCase(page.name)}-view { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.form-container { max-width: 600px; }
.stat-value { font-size: 36px; font-weight: bold; color: #409eff; text-align: center; padding: 20px; }
</style>
`,
    });
  });

  // ── env.d.ts ──
  files.push({
    name: "frontend/src/env.d.ts",
    type: "typescript",
    content: `/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
`,
  });

  return files;
}

// ════════════════════════════════════════════════════════
//  Generator: Java Spring Boot
// ════════════════════════════════════════════════════════

function generateSpringTarget(app, objectsWithProps) {
  const files = [];
  const appName = app.name || "MetaPlatform App";
  const basePackage = "com.metaplatform." + toKebabCase(appName).replace(/-/g, "");
  const basePackagePath = basePackage.replace(/\./g, "/");

  // ── pom.xml ──
  files.push({
    name: "backend/pom.xml",
    type: "xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
    <relativePath/>
  </parent>
  <groupId>${basePackage}</groupId>
  <artifactId>${toKebabCase(appName)}-backend</artifactId>
  <version>${app.version || "1.0.0"}</version>
  <name>${appName} Backend</name>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes>
            <exclude>
              <groupId>org.projectlombok</groupId>
              <artifactId>lombok</artifactId>
            </exclude>
          </excludes>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
  });

  // ── Application.java ──
  const mainClassName = toPascalCase(appName).replace(/[^a-zA-Z0-9]/g, "") + "Application";
  files.push({
    name: `backend/src/main/java/${basePackagePath}/${mainClassName}.java`,
    type: "java",
    content: `package ${basePackage};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${mainClassName} {

    public static void main(String[] args) {
        SpringApplication.run(${mainClassName}.class, args);
    }
}
`,
  });

  // ── application.yml ──
  files.push({
    name: "backend/src/main/resources/application.yml",
    type: "yaml",
    content: `server:
  port: 8080

spring:
  application:
    name: ${toKebabCase(appName)}-backend
  datasource:
    url: jdbc:postgresql://localhost:5432/${toKebabCase(appName).replace(/-/g, "_")}
    username: \${DB_USERNAME:postgres}
    password: \${DB_PASSWORD:postgres}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
  jackson:
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false

logging:
  level:
    ${basePackage}: INFO
    org.hibernate.SQL: WARN
`,
  });

  // ── Entity classes from ontology objects ──
  objectsWithProps.forEach((obj) => {
    const entityName = toPascalCase(obj.name);
    const tableName = toKebabCase(obj.name).replace(/-/g, "_");

    const fields = (obj.properties || []).map((p) => {
      const javaType = propTypeToJava(p.type);
      const columnName = toKebabCase(p.name).replace(/-/g, "_");
      const extras = jpaColumnExtras(p);
      const annotations = [];
      annotations.push(`    @Column(name = "${columnName}"${extras})`);
      if (p.required) {
        annotations.push(`    @jakarta.validation.constraints.NotNull`);
      }
      if (p.type === "email") {
        annotations.push(`    @jakarta.validation.constraints.Email`);
      }
      annotations.push(`    private ${javaType} ${p.name};`);
      return annotations.join("\n");
    }).join("\n\n");

    files.push({
      name: `backend/src/main/java/${basePackagePath}/entity/${entityName}.java`,
      type: "java",
      content: `package ${basePackage}.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.*;
import java.math.BigDecimal;

@Entity
@Table(name = "${tableName}")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ${entityName} {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

${fields}

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
`,
    });

    // ── Repository ──
    files.push({
      name: `backend/src/main/java/${basePackagePath}/repository/${entityName}Repository.java`,
      type: "java",
      content: `package ${basePackage}.repository;

import ${basePackage}.entity.${entityName};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${entityName}Repository extends JpaRepository<${entityName}, String> {
}
`,
    });

    // ── Service ──
    files.push({
      name: `backend/src/main/java/${basePackagePath}/service/${entityName}Service.java`,
      type: "java",
      content: `package ${basePackage}.service;

import ${basePackage}.entity.${entityName};
import ${basePackage}.repository.${entityName}Repository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ${entityName}Service {

    private final ${entityName}Repository repository;

    public List<${entityName}> findAll() {
        return repository.findAll();
    }

    public ${entityName} findById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("${obj.label} not found: " + id));
    }

    public ${entityName} create(${entityName} entity) {
        return repository.save(entity);
    }

    public ${entityName} update(String id, ${entityName} entity) {
        ${entityName} existing = findById(id);
        // Merge fields
${(obj.properties || []).map((p) => `        if (entity.get${toPascalCase(p.name)}() != null) existing.set${toPascalCase(p.name)}(entity.get${toPascalCase(p.name)}());`).join("\n")}
        return repository.save(existing);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }
}
`,
    });

    // ── Controller ──
    files.push({
      name: `backend/src/main/java/${basePackagePath}/controller/${entityName}Controller.java`,
      type: "java",
      content: `package ${basePackage}.controller;

import ${basePackage}.entity.${entityName};
import ${basePackage}.service.${entityName}Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/${toKebabCase(obj.name)}")
@RequiredArgsConstructor
public class ${entityName}Controller {

    private final ${entityName}Service service;

    @GetMapping
    public ResponseEntity<List<${entityName}>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<${entityName}> findById(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<${entityName}> create(@RequestBody ${entityName} entity) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<${entityName}> update(@PathVariable String id, @RequestBody ${entityName} entity) {
        return ResponseEntity.ok(service.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`,
    });
  });

  // ── Global exception handler ──
  files.push({
    name: `backend/src/main/java/${basePackagePath}/config/GlobalExceptionHandler.java`,
    type: "java",
    content: `package ${basePackage}.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "success", false,
                "error", ex.getMessage(),
                "timestamp", LocalDateTime.now().toString()
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Internal Server Error",
                "timestamp", LocalDateTime.now().toString()
        ));
    }
}
`,
  });

  return files;
}

// ════════════════════════════════════════════════════════
//  Generator: Java DDL (SQL migration)
// ════════════════════════════════════════════════════════

function generateDdlTarget(app, objectsWithProps) {
  const files = [];
  const appName = app.name || "MetaPlatform App";

  // ── CREATE TABLE statements ──
  const createStatements = objectsWithProps.map((obj) => {
    const tableName = toKebabCase(obj.name).replace(/-/g, "_");
    const columns = (obj.properties || []).map((p) => {
      const sqlType = propTypeToSQL(p.type);
      const constraints = [];
      if (p.required) constraints.push("NOT NULL");
      if (p.unique_field) constraints.push("UNIQUE");
      if (p.default_value) {
        const def = isNaN(p.default_value) ? `'${p.default_value}'` : p.default_value;
        constraints.push(`DEFAULT ${def}`);
      }
      return `    ${toKebabCase(p.name).replace(/-/g, "_")} ${sqlType}${constraints.length ? " " + constraints.join(" ") : ""}`;
    });

    return `CREATE TABLE IF NOT EXISTS ${tableName} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
${columns.join(",\n")},
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);`;
  }).join("\n\n");

  // ── Seed data INSERT statements ──
  const seedStatements = objectsWithProps.map((obj) => {
    const tableName = toKebabCase(obj.name).replace(/-/g, "_");
    const requiredProps = (obj.properties || []).filter((p) => p.required);
    if (requiredProps.length === 0) return "";

    const colNames = requiredProps.map((p) => toKebabCase(p.name).replace(/-/g, "_")).join(", ");
    const sampleValues = requiredProps.map((p) => {
      if (p.type === "text" || p.type === "email" || p.type === "phone") return `'sample_${p.name}'`;
      if (p.type === "number" || p.type === "integer") return "1";
      if (p.type === "boolean") return "true";
      if (p.type === "date") return "'2024-01-01'";
      if (p.type === "datetime") return "'2024-01-01T00:00:00'";
      return `'sample'`;
    }).join(", ");

    return `-- Seed data for ${obj.label}\nINSERT INTO ${tableName} (${colNames}) VALUES (${sampleValues});`;
  }).filter(Boolean).join("\n\n");

  // ── Flyway migration script ──
  files.push({
    name: `database/V1__init_${toKebabCase(appName)}.sql`,
    type: "sql",
    content: `-- ═══════════════════════════════════════════════════════
-- ${appName} — Database initialization script
-- Auto-generated by MetaPlatform Code Export Engine
-- ═══════════════════════════════════════════════════════

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ──
${createStatements}

${seedStatements ? `-- ── Seed Data ──\n${seedStatements}` : "-- No seed data"}
`,
  });

  // ── Also generate standalone DDL file ──
  files.push({
    name: `database/schema.sql`,
    type: "sql",
    content: `-- ${appName} — Schema DDL
-- Generated: ${new Date().toISOString()}

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

${createStatements}
`,
  });

  // ── Also generate standalone DML file ──
  if (seedStatements) {
    files.push({
      name: `database/seed.sql`,
      type: "sql",
      content: `-- ${appName} — Seed Data
-- Generated: ${new Date().toISOString()}

${seedStatements}
`,
    });
  }

  return files;
}

// ════════════════════════════════════════════════════════
//  Generator: Docker
// ════════════════════════════════════════════════════════

function generateDockerTarget(app) {
  const files = [];
  const appName = app.name || "MetaPlatform App";
  const appKebab = toKebabCase(appName);

  // ── Dockerfile (multi-stage: build frontend + backend, serve with nginx) ──
  files.push({
    name: "deploy/Dockerfile",
    type: "dockerfile",
    content: `# ════════════════════════════════════════════════════
# Stage 1: Build frontend
# ════════════════════════════════════════════════════
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ════════════════════════════════════════════════════
# Stage 2: Build backend
# ════════════════════════════════════════════════════
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B
COPY backend/src ./src
RUN mvn package -DskipTests -B

# ════════════════════════════════════════════════════
# Stage 3: Production image
# ════════════════════════════════════════════════════
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy backend JAR
COPY --from=backend-build /app/backend/target/*.jar app.jar

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist ./static

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Install nginx for serving static files
RUN apk add --no-cache nginx

# Expose ports
EXPOSE 80 8080

# Start script: run nginx + java backend
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
`,
  });

  // ── entrypoint.sh ──
  files.push({
    name: "deploy/entrypoint.sh",
    type: "shell",
    content: `#!/bin/sh
# Start nginx for static frontend
nginx

# Start Spring Boot backend
java -jar /app/app.jar \\
  --server.port=8080 \\
  --spring.datasource.url="\${SPRING_DATASOURCE_URL:-jdbc:postgresql://db:5432/${appKebab.replace(/-/g, "_")}}" \\
  --spring.datasource.username="\${SPRING_DATASOURCE_USERNAME:-postgres}" \\
  --spring.datasource.password="\${SPRING_DATASOURCE_PASSWORD:-postgres}"
`,
  });

  // ── nginx.conf ──
  files.push({
    name: "deploy/nginx.conf",
    type: "nginx",
    content: `worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    server {
        listen 80;
        server_name localhost;

        # Serve frontend static files
        root /app/static;
        index index.html;

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Proxy API requests to backend
        location /api/ {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
`,
  });

  // ── docker-compose.yml ──
  files.push({
    name: "deploy/docker-compose.yml",
    type: "yaml",
    content: `version: "3.8"

services:
  app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    container_name: ${appKebab}-app
    ports:
      - "80:80"
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/${appKebab.replace(/-/g, "_")}
      - SPRING_DATASOURCE_USERNAME=postgres
      - SPRING_DATASOURCE_PASSWORD=postgres
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: ${appKebab}-db
    environment:
      - POSTGRES_DB=${appKebab.replace(/-/g, "_")}
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ../database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
`,
  });

  // ── .dockerignore ──
  files.push({
    name: ".dockerignore",
    type: "text",
    content: `node_modules
frontend/node_modules
backend/target
.git
.env
*.log
`,
  });

  return files;
}

// ════════════════════════════════════════════════════════
//  POST /generate — Generate export package
// ════════════════════════════════════════════════════════

router.post("/generate", (req, res, next) => {
  try {
    const { appId, targets = [], options = {} } = req.body;

    if (!appId) {
      return res.status(400).json({ success: false, error: "appId 为必填项" });
    }

    // Read application
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(appId);
    if (!app) {
      return res.status(404).json({ success: false, error: "应用不存在" });
    }

    // Read app pages
    const pages = db.prepare(
      "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(appId);

    // Read ontology objects with properties
    const objects = db.prepare(
      "SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at ASC"
    ).all(appId);

    const objectsWithProps = objects.map((obj) => {
      const properties = db.prepare(
        "SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order"
      ).all(obj.id);
      return { ...obj, properties };
    });

    // Generate files based on selected targets
    const allFiles = [];
    const exportId = uuid();

    if (targets.includes("vue")) {
      allFiles.push(...generateVueTarget(app, pages, objectsWithProps));
    }

    if (targets.includes("java-spring")) {
      allFiles.push(...generateSpringTarget(app, objectsWithProps));
    }

    if (targets.includes("java-ddl")) {
      allFiles.push(...generateDdlTarget(app, objectsWithProps));
    }

    if (targets.includes("docker")) {
      allFiles.push(...generateDockerTarget(app));
    }

    // If no valid targets were provided, return an error
    if (allFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "未选择有效的导出目标，可选: vue, java-spring, java-ddl, docker",
      });
    }

    res.json({
      success: true,
      data: {
        exportId,
        files: allFiles,
        status: "completed",
        app: {
          id: app.id,
          name: app.name,
          version: app.version,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  POST /download — Download export as JSON file list
// ════════════════════════════════════════════════════════

router.post("/download", (req, res, next) => {
  try {
    const { appId, targets = [] } = req.body;

    if (!appId) {
      return res.status(400).json({ success: false, error: "appId 为必填项" });
    }

    // Re-generate (same logic as /generate, but returns as downloadable)
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(appId);
    if (!app) {
      return res.status(404).json({ success: false, error: "应用不存在" });
    }

    const pages = db.prepare(
      "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(appId);

    const objects = db.prepare(
      "SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at ASC"
    ).all(appId);

    const objectsWithProps = objects.map((obj) => {
      const properties = db.prepare(
        "SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order"
      ).all(obj.id);
      return { ...obj, properties };
    });

    const allFiles = [];

    if (targets.includes("vue")) allFiles.push(...generateVueTarget(app, pages, objectsWithProps));
    if (targets.includes("java-spring")) allFiles.push(...generateSpringTarget(app, objectsWithProps));
    if (targets.includes("java-ddl")) allFiles.push(...generateDdlTarget(app, objectsWithProps));
    if (targets.includes("docker")) allFiles.push(...generateDockerTarget(app));

    // Return as downloadable JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${toKebabCase(app.name)}-export.json"`);
    res.json({
      success: true,
      data: {
        exportId: uuid(),
        files: allFiles,
        status: "completed",
        app: { id: app.id, name: app.name, version: app.version },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
