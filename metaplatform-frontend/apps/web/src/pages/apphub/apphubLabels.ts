/**
 * 应用中心分类文案。
 *
 * 平台有两套彼此独立的分类轴：
 *   - `group`（技术分类，后端 `category`）：platform / knowledge / data / business
 *   - `businessDomain`（业务域，后端 `business_domain`）：平台底座 / 订单域 / …
 *
 * 技术分类是后端固定的枚举码，UI 要中文，所以在前端映射；
 * 业务域是一等实体（可增可改），中文名由后端下发（`BusinessDomain.name`），
 * 前端**不**再维护一份，避免两处漂移。
 */

/** 技术分类码 → 中文。未知码回退为原始码，不隐藏数据。 */
export const CATEGORY_LABELS: Record<string, string> = {
  platform: '平台',
  knowledge: '知识',
  data: '数据',
  business: '业务',
};

export function categoryLabel(code: string | undefined | null): string {
  if (!code) return '';
  return CATEGORY_LABELS[code] ?? code;
}
