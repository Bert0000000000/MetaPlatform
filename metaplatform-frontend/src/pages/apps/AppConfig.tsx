import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Key, Globe, Bell, Link2, Shield, Webhook, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function AppConfig() {
  const [showKey, setShowKey] = useState(false);
  const apiKey = "mp_sk_live_5j2k4l3m2n1o0p9q8r7s6t5u4v3w2x1y0z";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="应用配置"
        description="权限 + 通知 + OpenAPI + 集成"
      />

      <Tabs defaultValue="permission" orientation="vertical">
        <div className="flex gap-4">
          <TabsList className="flex-col h-fit w-48 bg-transparent p-0 gap-1">
            <TabsTrigger value="permission" className="w-full justify-start data-[state=active]:bg-muted">
              <Shield className="size-4 mr-2" /> 权限
            </TabsTrigger>
            <TabsTrigger value="notification" className="w-full justify-start data-[state=active]:bg-muted">
              <Bell className="size-4 mr-2" /> 通知
            </TabsTrigger>
            <TabsTrigger value="openapi" className="w-full justify-start data-[state=active]:bg-muted">
              <Key className="size-4 mr-2" /> OpenAPI
            </TabsTrigger>
            <TabsTrigger value="integration" className="w-full justify-start data-[state=active]:bg-muted">
              <Link2 className="size-4 mr-2" /> 集成
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 space-y-4">
            {/* 权限配置 */}
            <TabsContent value="permission" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">应用权限</CardTitle>
                  <CardDescription>谁能访问这个应用</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">公开访问</div>
                      <div className="text-xs text-muted-foreground">所有人都可以查看</div>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">需要审批</div>
                      <div className="text-xs text-muted-foreground">新用户访问需审批</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">数据权限</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>行级权限</span>
                    <Badge variant="default">启用</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>字段级权限</span>
                    <Badge variant="default">启用</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>脱敏规则</span>
                    <Badge variant="secondary">未配置</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 通知配置 */}
            <TabsContent value="notification" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">通知渠道</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "邮件通知", desc: "通过 SMTP 发送邮件", enabled: true },
                    { name: "短信通知", desc: "通过阿里云/腾讯云发送", enabled: false },
                    { name: "飞书", desc: "飞书机器人/Webhook", enabled: true },
                    { name: "钉钉", desc: "钉钉机器人/Webhook", enabled: false },
                    { name: "企微", desc: "企业微信应用消息", enabled: true },
                    { name: "应用内通知", desc: "站内消息中心", enabled: true },
                  ].map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{ch.name}</div>
                        <div className="text-xs text-muted-foreground">{ch.desc}</div>
                      </div>
                      <Switch defaultChecked={ch.enabled} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* OpenAPI */}
            <TabsContent value="openapi" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Key</CardTitle>
                  <CardDescription>使用此 Key 调用本应用的 OpenAPI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button variant="outline">重新生成</Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>限流：</span>
                      <Badge>1000 次/分钟</Badge>
                    </div>
                    <Button variant="outline" size="sm">查看 API 文档</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API 列表</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <span>GET /api/v1/apps/{`{id}`}</span>
                      <Badge variant="outline">公开</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <span>POST /api/v1/apps/{`{id}`}/instances</span>
                      <Badge>已认证</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <span>POST /api/v1/apps/{`{id}`}/processes/{`{key}`}/start</span>
                      <Badge>已认证</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Webhook className="size-4" /> Webhook
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <span>https://your-app.com/webhook</span>
                      <Badge variant="default">活跃</Badge>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2">+ 添加 Webhook</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 集成 */}
            <TabsContent value="integration" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">IM 集成</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["飞书", "钉钉", "企微", "Teams"].map((im) => (
                    <div key={im} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{im === "飞书" ? "📘" : im === "钉钉" ? "🔵" : im === "企微" ? "🟢" : "🟣"}</span>
                        <div>
                          <div className="font-medium text-sm">{im}</div>
                          <div className="text-xs text-muted-foreground">未配置</div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">配置</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="size-4" /> 单点登录 (SSO)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-3">配置 OAuth2 / SAML 2.0</div>
                  <Button variant="outline" size="sm">配置 SSO</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}