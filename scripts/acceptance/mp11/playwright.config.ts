import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(__dirname,'../../..');
const requireFrontend=createRequire(path.join(root,'metaplatform-frontend/package.json'));
const {defineConfig,devices}=requireFrontend('@playwright/test');
const privateDir=path.join(root,'.tmp/codex-mp11-candidate');
const session=JSON.parse(readFileSync(path.join(privateDir,'ui-session.json'),'utf8'));
const credentials=JSON.parse(readFileSync(path.join(privateDir,'credentials.json'),'utf8'));
process.env.MP11_SESSION_FILE=path.join(privateDir,'ui-session.json');
process.env.MP11_UI_TOKEN=session.writer.token;
process.env.MP11_UI_TENANT=session.writer.tenant;
process.env.MP11_UI_SUBJECT=session.writer.subject;
process.env.MP11_EMPTY_TOKEN=session.empty.token;
process.env.MP11_EMPTY_TENANT=session.empty.tenant;
process.env.MP11_API_URL=session.api;
process.env.MP11_API_EVIDENCE=path.join(root,'docs/active/delivery/evidence/mp11-candidate/acceptance.json');
process.env.E2E_GATEWAY=session.api;
process.env.E2E_GATEWAY_URL=session.api;
process.env.E2E_TENANT=session.writer.tenant;
process.env.E2E_IAM_LOGIN_URL='http://127.0.0.1:55523/api/v1/iam/auth/login';
process.env.E2E_USERNAME='writer';process.env.E2E_PASSWORD=credentials.writer_password;
export default defineConfig({
 projects:[{name:'web',testDir:path.join(root,'metaplatform-frontend/apps/web/tests/e2e'),testMatch:/(?:^|[\\/])(ontology-(relationship-flow|object-creation-flow|ia-v2-data-flow|migration-plan)|mp11-(order-app-flow|catalog-pagination)|website-entry)\.spec\.ts$/},{name:'core',testDir:path.join(root,'metaplatform-frontend/tests/e2e/ontology-loop'),testMatch:'ontology-core.spec.ts'}],
 timeout:120000,workers:1,retries:0,fullyParallel:false,
 reporter:[['list']],outputDir:path.join(privateDir,'playwright-results'),
 use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:9368',trace:'off',video:'off',screenshot:'off',actionTimeout:15000},
});
