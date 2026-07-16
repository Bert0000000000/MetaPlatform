package com.metaplatform.appservice.domain.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * BPMN XML 解析器：提取 process key、用户任务字段权限等。
 */
public class BpmnXmlParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String FLOWABLE_NS = "http://flowable.org/bpmn";

    public static String extractProcessKey(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.isBlank()) return null;
        try {
            Document doc = parse(bpmnXml);
            NodeList processes = doc.getElementsByTagNameNS("*", "process");
            if (processes.getLength() == 0) return null;
            Element process = (Element) processes.item(0);
            return process.getAttribute("id");
        } catch (Exception e) {
            throw ApiException.badRequest("BPMN XML 解析失败: " + e.getMessage());
        }
    }

    public static String extractFieldPermissions(String bpmnXml) {
        if (bpmnXml == null || bpmnXml.isBlank()) return "{}";
        try {
            Document doc = parse(bpmnXml);
            NodeList tasks = doc.getElementsByTagNameNS("*", "userTask");
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            for (int i = 0; i < tasks.getLength(); i++) {
                Element task = (Element) tasks.item(i);
                String taskId = task.getAttribute("id");
                String taskName = task.getAttribute("name");
                Map<String, Object> cfg = new LinkedHashMap<>();
                cfg.put("name", taskName);

                String candidateGroups = getAttribute(task, FLOWABLE_NS, "candidateGroups");
                if (candidateGroups != null && !candidateGroups.isBlank()) {
                    cfg.put("candidateGroups", candidateGroups.split(","));
                }
                String assignee = getAttribute(task, FLOWABLE_NS, "assignee");
                if (assignee != null && !assignee.isBlank()) {
                    cfg.put("assignee", assignee);
                }

                Map<String, Object> fp = extractFieldPermissionsFromTask(task);
                if (!fp.isEmpty()) {
                    cfg.put("fieldPermissions", fp);
                }
                result.put(taskId, cfg);
            }
            return MAPPER.writeValueAsString(result);
        } catch (Exception e) {
            throw ApiException.badRequest("BPMN 字段权限解析失败: " + e.getMessage());
        }
    }

    private static Map<String, Object> extractFieldPermissionsFromTask(Element task) {
        Map<String, Object> fp = new LinkedHashMap<>();
        NodeList extensions = task.getElementsByTagNameNS("*", "extensionElements");
        if (extensions.getLength() == 0) return fp;
        Element ext = (Element) extensions.item(0);
        NodeList children = ext.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE && "fieldPermissions".equals(child.getLocalName())) {
                String text = child.getTextContent();
                if (text != null && !text.isBlank()) {
                    try {
                        return MAPPER.readValue(text.trim(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
                    } catch (Exception ignored) {}
                }
            }
        }
        return fp;
    }

    private static String getAttribute(Element el, String namespaceUri, String localName) {
        String value = el.getAttributeNS(namespaceUri, localName);
        if (value != null && !value.isEmpty()) return value;
        // fallback to qualified name (namespace-unaware or custom prefix)
        String qualified = el.getAttribute("flowable:" + localName);
        if (qualified != null && !qualified.isEmpty()) return qualified;
        return null;
    }

    private static Document parse(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes()));
    }
}
