import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const repo = path.resolve(root, '../..');
const metadata = JSON.parse(fs.readFileSync(path.join(root,'github-metadata.json'),'utf8').replace(/^\uFEFF/,''));
const snapshots = JSON.parse(fs.readFileSync(path.join(root,'commit-snapshots.json'),'utf8').replace(/^\uFEFF/,''));
const audits = {
  'deepseek-ai/deepseek-harness': ['MIT','LICENSE','Agent 客户端；复用官方 MCP 接入，非本体替代品'],
  'appsmithorg/appsmith': ['Apache-2.0（根许可；EE 另审）','LICENSE','应用中心重点对标：绑定、预览、发布体验'],
  'HKUDS/LightRAG': ['MIT','LICENSE','当前栈已采用；优化现有接入，不重复新增 GraphRAG'],
  'directus/directus': ['MSCL-1.0-GPL；限制竞争用途，4 年后 GPL','license','source-available；不建议作为 MetaPlatform 商业底座 fork'],
  'getzep/graphiti': ['Apache-2.0','LICENSE','时态 Agent 记忆候选，1.2 后独立 PoC'],
  'Budibase/budibase': ['总体 GPLv3；客户端 MPL；pro BSL','LICENSE','操作流参考；源码嵌入按包审计'],
  'PrefectHQ/fastmcp': ['Apache-2.0','LICENSE','MCP 框架备选；先保留现有官方 SDK'],
  'modelcontextprotocol/python-sdk': ['MIT','LICENSE','现有协议基础，保持版本兼容'],
  'nocobase/nocobase': ['Apache + 根补充协议；头部另有 AGPL 口径','LICENSE.txt','业务模型与插件 UX 重点参考；不直接复制或整体 fork'],
  'neo4j/neo4j': ['GPL-3.0（当前仓库）','LICENSE.txt','图存储备选；1.1 不换内核'],
  'open-metadata/OpenMetadata': ['Apache-2.0','LICENSE','数据体验首选；元数据 adapter 首选 PoC'],
  'datahub-project/datahub': ['Apache-2.0','LICENSE','数据目录/血缘强备选；不与 OpenMetadata 同时引入'],
  'TerminusDB/terminusdb': ['Apache-2.0','LICENSE','数据版本思路参考；迁移成本需评估'],
  'apache/hugegraph': ['Apache-2.0','LICENSE','图数据库，测得容量瓶颈后才评估'],
  'protegeproject/protege': ['BSD-2-Clause（license.txt）','license.txt','专业桌面 OWL 编辑；专家互操作参考'],
  'apache/jena': ['Apache-2.0','LICENSE','RDF/SPARQL/SHACL 标准验证参考'],
  'VisualDataWeb/WebVOWL': ['MIT','license.txt','OWL 图交互参考；更新较久，非关键 UI 依赖'],
  'ontop/ontop': ['Apache-2.0','LICENSE.txt','关系数据库 → 虚拟 RDF 映射参考'],
  'protegeproject/webprotege': ['BSD-2-Clause（license.txt）','license.txt','本体编辑/权限/变更协作重点参考'],
  'ge-semtk/semtk': ['Apache-2.0（LICENSE.txt）','LICENSE.txt','2025 后未 push；本轮仅历史参考']
};
const rows = metadata.map(meta => {
  const [license,file,recommendation] = audits[Object.keys(audits).find(key => key.toLowerCase() === meta.full_name.toLowerCase())];
  const snapshot = snapshots.find(x=>x.full_name===meta.full_name);
  const url = `https://github.com/${meta.full_name}/blob/${snapshot.sha}/${file}`;
  return `| ${meta.stars} | ${meta.forks} | ${meta.pushed_at.slice(0,10)} | ${meta.language} | [${license}](${url}) | [${meta.full_name}](${meta.url})：${recommendation} |`;
});
const reportPath = path.join(repo,'docs/active/research/2026-10-11-ontology-platform-survey.md');
let report = fs.readFileSync(reportPath,'utf8');
report = report.replace(/(\| ⭐ Stars[^\n]*\n\|---\|---\|---\|---\|---\|---\|\n)[\s\S]*?(?=\n本轮查明)/, '$1' + rows.join('\n') + '\n');
report = report.replace('演進','演进');
fs.writeFileSync(reportPath,report,'utf8');
fs.writeFileSync(path.join(root,'license-audit.json'),JSON.stringify(metadata.map(meta=>({repo:meta.full_name,license:audits[Object.keys(audits).find(key => key.toLowerCase() === meta.full_name.toLowerCase())][0],file:audits[Object.keys(audits).find(key => key.toLowerCase() === meta.full_name.toLowerCase())][1],recommendation:audits[Object.keys(audits).find(key => key.toLowerCase() === meta.full_name.toLowerCase())][2]})),null,2)+'\n');
const specPath = path.join(repo,'docs/active/specs/2026-10-11-metaplatform-product-v1.1.md');
fs.writeFileSync(specPath,fs.readFileSync(specPath,'utf8').replace('達标','达标'),'utf8');
console.log(JSON.stringify({tableRows:rows.length,requirements:[...new Set(fs.readFileSync(specPath,'utf8').match(/MP11-[A-Z]+-\d+/g))].length}));
