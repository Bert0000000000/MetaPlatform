package com.metaplatform.wfe.engine.converter;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.engine.model.FlowDocument;
import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.exception.WfeException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.*;

/**
 * BPMN → FlowGram.AI JSON 转换器。
 * 支持的 BPMN 元素：startEvent, userTask, endEvent, sequenceFlow。
 * 不支持复杂网关（需手动转换）。
 * 用于兼容现有的 release-approval.bpmn20.xml（线性两段审批）。
 */
@Component
@RequiredArgsConstructor
public class BpmnToFlowGramConverter {

    private final ObjectMapper objectMapper;

    /**
     * 将简单 BPMN XML 转换为 FlowGram.AI JSON (Map)。
     * 支持传入 String（XML 字符串）或 Map<String,Object>（BPMN XML 包装结构）。
     */
    public Map<String, Object> convert(Object bpmnXml) {
        String xml = normalizeBpmnXml(bpmnXml);
        if (xml == null || xml.isBlank()) {
            return null;
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document document = builder.parse(new InputSource(new StringReader(xml)));

            Map<String, Element> elementMap = new HashMap<>();
            addElementsToMap(document.getElementsByTagName("startEvent"), elementMap);
            addElementsToMap(document.getElementsByTagName("userTask"), elementMap);
            addElementsToMap(document.getElementsByTagName("endEvent"), elementMap);
            addElementsToMap(document.getElementsByTagName("serviceTask"), elementMap);
            addElementsToMap(document.getElementsByTagName("exclusiveGateway"), elementMap);

            Map<String, String> flowMap = new HashMap<>();
            NodeList flows = document.getElementsByTagName("sequenceFlow");
            for (int i = 0; i < flows.getLength(); i++) {
                Element flow = (Element) flows.item(i);
                String sourceRef = flow.getAttribute("sourceRef");
                String targetRef = flow.getAttribute("targetRef");
                if (!sourceRef.isEmpty()) {
                    flowMap.putIfAbsent(sourceRef, targetRef);
                }
            }

            NodeList startEvents = document.getElementsByTagName("startEvent");
            if (startEvents.getLength() == 0) {
                throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "BPMN 缺少 startEvent");
            }
            String currentId = ((Element) startEvents.item(0)).getAttribute("id");

            List<FlowNode> nodes = new ArrayList<>();
            Set<String> visited = new HashSet<>();
            while (currentId != null && !currentId.isEmpty() && !visited.contains(currentId)) {
                visited.add(currentId);
                Element elem = elementMap.get(currentId);
                if (elem == null) {
                    break;
                }
                nodes.add(toFlowNode(elem));
                currentId = flowMap.get(currentId);
            }

            FlowDocument doc = new FlowDocument(nodes);
            String json = objectMapper.writeValueAsString(doc);
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (WfeException e) {
            throw e;
        } catch (Exception e) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "BPMN XML 解析失败: " + e.getMessage());
        }
    }

    /**
     * 将 BPMN XML 的多种载体（String / Map<String,Object>）规整为 String。
     */
    private String normalizeBpmnXml(Object bpmnXml) {
        if (bpmnXml == null) {
            return null;
        }
        if (bpmnXml instanceof String s) {
            return s;
        }
        if (bpmnXml instanceof Map<?, ?> map) {
            Object xml = map.get("xml");
            if (xml == null) {
                xml = map.get("text");
            }
            if (xml == null) {
                xml = map.get("content");
            }
            return xml == null ? null : xml.toString();
        }
        return bpmnXml.toString();
    }

    private void addElementsToMap(NodeList nodeList, Map<String, Element> map) {
        for (int i = 0; i < nodeList.getLength(); i++) {
            Element elem = (Element) nodeList.item(i);
            String id = elem.getAttribute("id");
            if (id != null && !id.isEmpty()) {
                map.put(id, elem);
            }
        }
    }

    private FlowNode toFlowNode(Element elem) {
        String id = elem.getAttribute("id");
        String name = elem.getAttribute("name");
        String tagName = elem.getTagName();

        String type;
        Map<String, Object> data = new HashMap<>();

        if ("startEvent".equals(tagName)) {
            type = "start";
        } else if ("userTask".equals(tagName)) {
            type = "approval";
            String assignee = elem.getAttribute("flowable:assignee");
            if (assignee != null && !assignee.isEmpty()) {
                data.put("assignee", assignee);
            }
        } else if ("endEvent".equals(tagName)) {
            type = "end";
        } else {
            type = "default";
        }

        if (name != null && !name.isEmpty()) {
            data.put("title", name);
        }

        return new FlowNode(id, type, new ArrayList<>(), data);
    }
}
