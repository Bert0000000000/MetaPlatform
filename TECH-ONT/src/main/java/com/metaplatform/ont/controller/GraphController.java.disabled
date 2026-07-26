package com.metaplatform.ont.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.GraphEdgeDto;
import com.metaplatform.ont.dto.GraphNodeDto;
import com.metaplatform.ont.dto.GraphQueryRequest;
import com.metaplatform.ont.dto.GraphQueryResponse;
import com.metaplatform.ont.dto.GraphStatsResponse;
import com.metaplatform.ont.service.GraphQueryService;
import com.metaplatform.ont.service.GraphStatsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/ont/graph")
@RequiredArgsConstructor
public class GraphController {

    private final GraphQueryService graphQueryService;
    private final GraphStatsService graphStatsService;
    private final ObjectMapper objectMapper;

    /**
     * 图谱查询（REQ-030, REQ-032, REQ-034）。
     * 支持以 startNodeId 或自然语言 query 作为起点；
     * 支持 nodeTypes / properties / tags 筛选；支持 depth 跳数扩展。
     */
    @PostMapping("/query")
    public ApiResponse<GraphQueryResponse> query(@Valid @RequestBody GraphQueryRequest request) {
        return ApiResponse.success(graphQueryService.query(request));
    }

    /**
     * 节点展开（REQ-035）：返回某节点的 N 跳邻居子图。
     * 用于前端 KnowledgeGraph 点击节点时增量加载子节点。
     */
    @GetMapping("/expand")
    public ApiResponse<GraphQueryResponse> expand(@RequestParam String nodeId,
                                                  @RequestParam(defaultValue = "1") int depth) {
        return ApiResponse.success(graphQueryService.expand(nodeId, depth));
    }

    @GetMapping("/stats")
    public ApiResponse<GraphStatsResponse> stats(@RequestParam String tenantId) {
        return ApiResponse.success(graphStatsService.getStats(tenantId));
    }

    /**
     * 图谱导出（P1-ONT）：导出节点与边，支持 json / csv / graphml 格式。
     *
     * @param format    导出格式：json（默认）、csv、graphml
     * @param nodeTypes 节点类型过滤（concept/entity/relation），为空则全部
     * @param edgeTypes 边类型过滤，为空则全部
     * @param limit     节点/边数量上限，默认 1000，上限 10000
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(defaultValue = "json") String format,
                                         @RequestParam(required = false) List<String> nodeTypes,
                                         @RequestParam(required = false) List<String> edgeTypes,
                                         @RequestParam(defaultValue = "1000") int limit) throws IOException {
        GraphQueryResponse graph = graphQueryService.export(nodeTypes, edgeTypes, limit);
        String fmt = format == null ? "json" : format.toLowerCase();
        byte[] body;
        MediaType contentType;
        String filename;
        switch (fmt) {
            case "csv" -> {
                body = toCsv(graph).getBytes(StandardCharsets.UTF_8);
                contentType = MediaType.parseMediaType("text/csv; charset=UTF-8");
                filename = "ontology-graph.csv";
            }
            case "graphml" -> {
                body = toGraphMl(graph).getBytes(StandardCharsets.UTF_8);
                contentType = MediaType.APPLICATION_XML;
                filename = "ontology-graph.graphml";
            }
            default -> {
                body = objectMapper.writeValueAsBytes(graph);
                contentType = MediaType.APPLICATION_JSON;
                filename = "ontology-graph.json";
            }
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentType(contentType);
        return new ResponseEntity<>(body, headers, HttpStatus.OK);
    }

    private String toCsv(GraphQueryResponse graph) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Nodes\n");
        sb.append("id,label,type\n");
        for (GraphNodeDto n : graph.getNodes()) {
            sb.append(csv(n.getId())).append(',')
                    .append(csv(n.getLabel())).append(',')
                    .append(csv(n.getType())).append('\n');
        }
        sb.append("\n# Edges\n");
        sb.append("id,source,target,type,label\n");
        for (GraphEdgeDto e : graph.getEdges()) {
            sb.append(csv(e.getId())).append(',')
                    .append(csv(e.getSource())).append(',')
                    .append(csv(e.getTarget())).append(',')
                    .append(csv(e.getType())).append(',')
                    .append(csv(e.getLabel())).append('\n');
        }
        return sb.toString();
    }

    private String csv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String toGraphMl(GraphQueryResponse graph) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<graphml xmlns=\"http://graphml.graphdrawing.org/xmlns\">\n");
        sb.append("  <graph edgedefault=\"undirected\">\n");
        for (GraphNodeDto n : graph.getNodes()) {
            sb.append("    <node id=\"").append(xmlEsc(n.getId())).append("\"/>\n");
        }
        for (GraphEdgeDto e : graph.getEdges()) {
            sb.append("    <edge id=\"").append(xmlEsc(e.getId()))
                    .append("\" source=\"").append(xmlEsc(e.getSource()))
                    .append("\" target=\"").append(xmlEsc(e.getTarget())).append("\"/>\n");
        }
        sb.append("  </graph>\n</graphml>\n");
        return sb.toString();
    }

    private String xmlEsc(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
