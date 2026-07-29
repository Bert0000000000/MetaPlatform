/**
 * SSO 厂商预设模板
 *
 * 每个 preset 提供：
 *  - 厂商基础信息（label / 描述 / 品牌色）
 *  - 默认 OAuth/OIDC 端点 + scopes
 *  - 厂商特定的 config 字段（如企业微信的 corpId、微信的 appId、飞书的 appType 等）
 *
 * 当管理员在 SSO 配置抽屉选择某个 preset 时，前端会一键填充端点 +
 * 自动展开该厂商所需的额外字段（保存在 provider.config JSON 字段中）。
 *
 * 注意：实际回调地址由 IAM 服务的 {id}/callback 提供，授权回调由浏览器发起，
 *      redirect_uri 与 issuer 在创建时仅作元信息使用。
 */

export type PresetType = 'OIDC' | 'OAUTH2' | 'SAML' | 'LDAP';

export interface SsoConfigField {
  key: string;
  label: string;
  /** 字段类型 */
  kind: 'text' | 'password' | 'number' | 'select' | 'boolean' | 'textarea';
  /** select 选项 */
  options?: Array<{ value: string; label: string }>;
  /** 占位提示 */
  placeholder?: string;
  /** 帮助说明（显示在字段下方） */
  help?: string;
  required?: boolean;
}

export interface SsoProviderPreset {
  /** preset 唯一标识 */
  id: string;
  /** 是否厂商预设（true）或通用协议预设（false） */
  vendor: boolean;
  type: PresetType;
  /** 显示名（中文） */
  label: string;
  /** 英文/品牌名 */
  brand: string;
  /** 简介 */
  description: string;
  /** 品牌主色（用于按钮/图标着色） */
  color: string;
  /** optional brand icon (React node) */
  icon?: import("react").ReactNode;
  /** OAuth/OIDC 授权端点（企业微信/微信/飞书通常为固定值） */
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  /** 默认 scopes（空格分隔） */
  scopes?: string;
  /** issuer / Realm 占位 */
  issuerPlaceholder?: string;
  /** 厂商特定 config 字段 */
  configFields?: SsoConfigField[];
  /** 帮助链接：管理员如何获取 clientId/clientSecret */
  helpDocUrl?: string;
}

// ===== 通用协议 =====

const GENERIC_OIDC: SsoProviderPreset = {
  id: 'generic-oidc',
  vendor: false,
  type: 'OIDC',
  label: '通用 OIDC',
  brand: 'OIDC',
  description: '兼容标准 OpenID Connect 协议的身份提供方（如 Keycloak、Authing、Logto 等）',
  color: '#60a5fa',
  issuerPlaceholder: 'https://example.com/realms/master',
  scopes: 'openid profile email',
  // OIDC 一般通过 issuer 自动发现，这里留空由管理员填入
};

const GENERIC_OAUTH2: SsoProviderPreset = {
  id: 'generic-oauth2',
  vendor: false,
  type: 'OAUTH2',
  label: '通用 OAuth 2.0',
  brand: 'OAuth2',
  description: '标准 OAuth 2.0 授权码流程，需手动填写授权、Token、UserInfo 三个端点',
  color: '#a78bfa',
  scopes: 'profile',
};

const GENERIC_SAML: SsoProviderPreset = {
  id: 'generic-saml',
  vendor: false,
  type: 'SAML',
  label: '通用 SAML 2.0',
  brand: 'SAML',
  description: 'SAML 2.0 SSO（适用于 Azure AD、企业 AD FS 等支持 SAML 的 IdP）',
  color: '#f59e0b',
  issuerPlaceholder: 'https://idp.example.com/saml/metadata',
};

const GENERIC_LDAP: SsoProviderPreset = {
  id: 'generic-ldap',
  vendor: false,
  type: 'LDAP',
  label: '通用 LDAP',
  brand: 'LDAP',
  description: '通过 LDAP 协议对接企业 AD / OpenLDAP，统一目录登录',
  color: '#94a3b8',
  configFields: [
    { key: 'host', label: 'LDAP 服务地址', kind: 'text', placeholder: 'ldap://ldap.example.com', required: true },
    { key: 'port', label: '端口', kind: 'number', placeholder: '389 / 636', required: true },
    { key: 'baseDn', label: 'Base DN', kind: 'text', placeholder: 'dc=example,dc=com', required: true },
    { key: 'userDnPattern', label: 'User DN Pattern', kind: 'text', placeholder: 'uid={0},ou=people,dc=example,dc=com', required: true },
    { key: 'ssl', label: '启用 SSL', kind: 'boolean', help: '勾选后使用 ldaps://' },
  ],
};

// ===== 中国生态厂商 =====

/**
 * 企业微信（WeCom / 企业号）
 *   OAuth 授权：https://login.work.weixin.qq.com/authorize
 *   扫码登录（构造网页应用）：https://login.work.weixin.qq.com/wwlogin/sso/login
 *   UserInfo（自建应用）：https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo (code -> userid)
 *   UserInfo（第三方应用）：https://qyapi.weixin.qq.com/cgi-bin/service/getuserinfo
 *   Token：https://qyapi.weixin.qq.com/cgi-bin/gettoken (corpid + corpsecret)
 */
const WECOM: SsoProviderPreset = {
  id: 'wecom',
  vendor: true,
  type: 'OAUTH2',
  label: '企业微信',
  brand: 'WeCom',
  description: '腾讯企业微信（WeCom / 企业号）OAuth 扫码登录',
  color: '#10b981',
  authorizationEndpoint: 'https://login.work.weixin.qq.com/authorize',
  tokenEndpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
  userInfoEndpoint: 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo',
  scopes: 'snsapi_base',
  helpDocUrl: 'https://developer.work.weixin.qq.com/document/path/91022',
  configFields: [
    { key: 'corpId', label: '企业 ID (CorpID)', kind: 'text', placeholder: 'ww1234567890abcdef', required: true, help: '我的企业 > 企业信息 > 企业 ID' },
    { key: 'agentId', label: '应用 AgentID', kind: 'text', placeholder: '1000002', required: true, help: '应用管理 > 自建应用 > AgentID' },
    { key: 'appSecret', label: '应用 Secret', kind: 'password', placeholder: '应用的 Secret', required: true, help: '应用管理 > 自建应用 > Secret' },
    { key: 'contactSecret', label: '通讯录 Secret（可选）', kind: 'password', help: '管理后台 > 客户联系 > 接入工具/API > Secret，用于拉取部门/成员' },
  ],
};

/**
 * 微信开放平台（开放网站应用扫码登录）
 *   授权：https://open.weixin.qq.com/connect/qrconnect
 *   Token：https://api.weixin.qq.com/sns/oauth2/access_token
 *   UserInfo：https://api.weixin.qq.com/sns/userinfo
 *   scopes：snsapi_login
 */
const WECHAT: SsoProviderPreset = {
  id: 'wechat',
  vendor: true,
  type: 'OAUTH2',
  label: '微信',
  brand: 'WeChat',
  description: '微信开放平台（open.weixin.qq.com）网站应用扫码登录',
  color: '#22c55e',
  authorizationEndpoint: 'https://open.weixin.qq.com/connect/qrconnect',
  tokenEndpoint: 'https://api.weixin.qq.com/sns/oauth2/access_token',
  userInfoEndpoint: 'https://api.weixin.qq.com/sns/userinfo',
  scopes: 'snsapi_login',
  helpDocUrl: 'https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html',
  configFields: [
    { key: 'appId', label: 'AppID', kind: 'text', placeholder: 'wx1234567890abcdef', required: true, help: '微信开放平台 > 网站应用 > AppID' },
    { key: 'appSecret', label: 'AppSecret', kind: 'password', placeholder: '应用密钥', required: true, help: '微信开放平台 > 网站应用 > AppSecret' },
    { key: 'originalId', label: '原始 ID（可选）', kind: 'text', help: '公众号原始 ID gh_xxxx（仅当使用同一主体时需要）' },
  ],
};

/**
 * 飞书（Lark）
 *   授权（自建应用）：https://open.feishu.cn/open-apis/authen/v1/index?app_id=...&redirect_uri=...&state=...
 *   授权（ISV）：https://open.feishu.cn/open-apis/authen/v1/index
 *   Token：https://open.feishu.cn/open-apis/authen/v2/oauth/token
 *   UserInfo：https://open.feishu.cn/open-apis/authen/v1/user_info
 *   scopes：contact:user.id:readonly（OIDC 自动包含 openid）
 */
const FEISHU: SsoProviderPreset = {
  id: 'feishu',
  vendor: true,
  type: 'OIDC',
  label: '飞书',
  brand: 'Feishu',
  description: '字节跳动飞书（Lark）开放平台 OAuth/OIDC 登录',
  color: '#3370ff',
  authorizationEndpoint: 'https://accounts.feishu.cn/open-apis/authen/v1/index',
  tokenEndpoint: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
  userInfoEndpoint: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
  scopes: 'openid profile email contact:user.base:readonly',
  helpDocUrl: 'https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/obtain-identity-token',
  configFields: [
    {
      key: 'appType',
      label: '应用类型',
      kind: 'select',
      required: true,
      options: [
        { value: 'CORP_APP', label: '企业自建应用' },
        { value: 'ISV_APP', label: 'ISV 第三方应用' },
      ],
      help: '自建应用 = 公司内部应用；ISV = 第三方分发应用',
    },
    { key: 'appId', label: 'App ID', kind: 'text', placeholder: 'cli_xxxxxxxx', required: true, help: '飞书开放平台 > 应用详情 > 凭证 > App ID' },
    { key: 'appSecret', label: 'App Secret', kind: 'password', placeholder: '应用密钥', required: true, help: '飞书开放平台 > 应用详情 > 凭证 > App Secret' },
  ],
};

/** 全部 preset */
export const SSO_PRESETS: SsoProviderPreset[] = [
  GENERIC_OIDC,
  GENERIC_OAUTH2,
  GENERIC_SAML,
  GENERIC_LDAP,
  WECOM,
  WECHAT,
  FEISHU,
];

/** 厂商预设（带品牌色，用于登录页按钮） */
export const SSO_VENDOR_PRESETS: SsoProviderPreset[] = [WECOM, WECHAT, FEISHU];

/** 按 id 查找 preset */
export function getPresetById(id: string | undefined | null): SsoProviderPreset | undefined {
  if (!id) return undefined;
  return SSO_PRESETS.find((p) => p.id === id);
}

/**
 * 从 SSO 提供方反推 preset id
 * 通过 issuer / 端点 URL 关键词匹配：匹配到第一个匹配项即返回
 */
export function matchPreset(provider: Pick<SsoProvider, 'authorizationEndpoint' | 'tokenEndpoint' | 'userInfoEndpoint'> & { config?: Record<string, unknown> }): SsoProviderPreset | undefined {
  const haystack = [
    provider.authorizationEndpoint || '',
    provider.tokenEndpoint || '',
    provider.userInfoEndpoint || '',
    JSON.stringify(provider.config || {}),
  ].join(' ').toLowerCase();
  if (haystack.includes('work.weixin.qq.com') || haystack.includes('qyapi.weixin')) return WECOM;
  if (haystack.includes('open.weixin.qq.com') || haystack.includes('mp.weixin')) return WECHAT;
  if (haystack.includes('feishu.cn') || haystack.includes('larksuite')) return FEISHU;
  return undefined;
}


// 类型引用来自 sso 模块，避免循环依赖
import type { SsoProvider } from './sso';
