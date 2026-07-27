package com.metaplatform.wfe.apphub.service;

import com.metaplatform.wfe.apphub.dto.AppCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppItemResponse;
import com.metaplatform.wfe.apphub.dto.AppUpdateRequest;
import com.metaplatform.wfe.common.PageResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class AppService {

    private final Map<String, AppItemResponse> store = new ConcurrentHashMap<>();

    public AppService() {
        // 预置示例数据，确保应用中心首页不空白
        seed("客户信息登记", "customer-info", "客户基础信息录入与查询应用", "FormOutlined", "办公应用", "PUBLISHED");
        seed("合同审批", "contract-approval", "销售合同多级审批与归档", "FileTextOutlined", "审批应用", "PUBLISHED");
        seed("日报汇总", "daily-report", "自动汇总各部门日报并生成统计", "BarChartOutlined", "数据应用", "DESIGNING");
    }

    private void seed(String name, String code, String description, String icon, String group, String status) {
        AppCreateRequest request = new AppCreateRequest();
        request.setName(name);
        request.setCode(code);
        request.setDescription(description);
        request.setIcon(icon);
        request.setGroup(group);
        request.setStatus(status);
        String appId = "app-" + UUID.randomUUID().toString().substring(0, 8);
        Instant now = Instant.now();
        store.put(appId, AppItemResponse.builder()
                .appId(appId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .icon(request.getIcon())
                .group(request.getGroup())
                .status(request.getStatus())
                .moduleCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    public PageResponse<AppItemResponse> list(String keyword, String group, String status, int page, int pageSize) {
        List<AppItemResponse> all = store.values().stream()
                .filter(a -> keyword == null || keyword.isBlank()
                        || a.getName().toLowerCase().contains(keyword.toLowerCase())
                        || a.getCode().toLowerCase().contains(keyword.toLowerCase()))
                .filter(a -> group == null || group.isBlank() || group.equals(a.getGroup()))
                .filter(a -> status == null || status.isBlank() || status.equals(a.getStatus()))
                .sorted(Comparator.comparing(AppItemResponse::getUpdatedAt).reversed())
                .collect(Collectors.toList());

        int total = all.size();
        int from = (page - 1) * pageSize;
        int to = Math.min(from + pageSize, total);
        List<AppItemResponse> items = from >= total ? new ArrayList<>() : all.subList(from, to);
        long totalPages = total == 0 ? 0 : (total + pageSize - 1L) / pageSize;

        return PageResponse.<AppItemResponse>builder()
                .items(items)
                .total(total)
                .page(page)
                .pageSize(pageSize)
                .totalPages(totalPages)
                .build();
    }

    public AppItemResponse get(String appId) {
        AppItemResponse app = store.get(appId);
        if (app == null) {
            throw new IllegalArgumentException("应用不存在: " + appId);
        }
        return app;
    }

    public AppItemResponse create(AppCreateRequest request) {
        String appId = "app-" + UUID.randomUUID().toString().substring(0, 8);
        Instant now = Instant.now();
        AppItemResponse item = AppItemResponse.builder()
                .appId(appId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .icon(request.getIcon())
                .group(request.getGroup())
                .status(request.getStatus() == null ? "DESIGNING" : request.getStatus())
                .moduleCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        store.put(appId, item);
        return item;
    }

    public AppItemResponse update(String appId, AppUpdateRequest request) {
        AppItemResponse existing = get(appId);
        if (request.getName() != null) existing.setName(request.getName());
        if (request.getCode() != null) existing.setCode(request.getCode());
        if (request.getDescription() != null) existing.setDescription(request.getDescription());
        if (request.getIcon() != null) existing.setIcon(request.getIcon());
        if (request.getGroup() != null) existing.setGroup(request.getGroup());
        if (request.getStatus() != null) existing.setStatus(request.getStatus());
        existing.setUpdatedAt(Instant.now());
        return existing;
    }

    public void delete(String appId) {
        store.remove(appId);
    }

    public List<String> listGroups() {
        return store.values().stream()
                .map(AppItemResponse::getGroup)
                .filter(g -> g != null && !g.isBlank())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }
}
