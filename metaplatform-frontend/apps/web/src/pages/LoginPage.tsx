/**
 * LoginPage - Portal 登录入口
 *
 * 复用 @mate/shared 的 SharedLoginPage，零业务逻辑，保证 dev/prod 一致。
 * （9200 与 9230 工作台是同一套 UI + 同一套行为。）
 */
export { default } from "@mate/shared/components/SharedLoginPage";