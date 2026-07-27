package com.metaplatform.agent.sandbox;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SandboxConfig {
    private String image;
    private int cpuMilli;
    private int memoryMb;
    private int diskMb;
    private int timeoutSeconds;
    private List<String> egressAllowList;   // 出网白名单域名
    private List<String> envKeys;            // 注入的 Secret 键名
    private boolean readOnlyRoot;
    private String securityContextUser;      // 通常 "1000:1000"
}
