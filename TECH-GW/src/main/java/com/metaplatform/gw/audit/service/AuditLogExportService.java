package com.metaplatform.gw.audit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.gw.audit.dto.AuditLogResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogExportService {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ExportedDocument export(String format, String tenantId, LocalDateTime start, LocalDateTime end) {
        List<AuditLogResponse> logs = auditLogService.exportRange(tenantId, start, end)
                .block();
        return render(format, logs);
    }

    public ExportedDocument render(String format, List<AuditLogResponse> logs) {
        if ("json".equalsIgnoreCase(format)) {
            return toJson(logs);
        }
        return toCsv(logs);
    }

    private ExportedDocument toJson(List<AuditLogResponse> logs) {
        try {
            return new ExportedDocument(objectMapper.writeValueAsString(logs), "application/json");
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize audit logs to JSON", e);
            return new ExportedDocument("[]", "application/json");
        }
    }

    private ExportedDocument toCsv(List<AuditLogResponse> logs) {
        String csv = logs.stream()
                .map(AuditLogExportService::toCsvLine)
                .collect(Collectors.joining("\n"));
        String body = "id,tenantId,apiId,path,method,statusCode,durationMs,userId,traceId,isError,createdAt\n" + csv;
        return new ExportedDocument(body, "text/csv");
    }

    private static String toCsvLine(AuditLogResponse r) {
        return String.format("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s",
                escape(r.getId()),
                escape(r.getTenantId()),
                escape(r.getApiId() == null ? "" : r.getApiId().toString()),
                escape(r.getPath()),
                escape(r.getMethod()),
                r.getStatusCode() == null ? "" : r.getStatusCode(),
                r.getDurationMs() == null ? "" : r.getDurationMs(),
                escape(r.getUserId()),
                escape(r.getTraceId()),
                Boolean.TRUE.equals(r.getIsError()),
                r.getCreatedAt() == null ? "" : r.getCreatedAt());
    }

    private static String escape(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    public static class ExportedDocument {
        private final String content;
        private final String contentType;

        public ExportedDocument(String content, String contentType) {
            this.content = content;
            this.contentType = contentType;
        }

        public String getContent() { return content; }
        public String getContentType() { return contentType; }
    }
}
