/**
 * LoginPage - Dashboard 工作台登录入口
 *
 * 复用 @mate/shared 的 SharedLoginPage，零业务逻辑，保证 dev/prod 一致。
 * 9200/9230 同一套 UI；此处覆盖品牌文本，让登录页明确标注"工作台"。
 */
import SharedLoginPage from "@mate/shared/components/SharedLoginPage";

export default function LoginPage() {
  return (
    <SharedLoginPage
      brandTitle="Mate 工作台"
      brandSubtitle="Workbench"
      brandTagline="工作台"
      brandDescription="基于本体论（Ontology）与 AI Agent 的统一工作入口 — 把待办、通知、数字员工、交付物、AIOps 异常与个人偏好装进同一个可解释的运行时。"
      brandTags={[
        { label: "工作台" },
        { label: "本体驱动" },
        { label: "数字员工" },
      ]}
      redirectTo="/dashboard"
    />
  );
}