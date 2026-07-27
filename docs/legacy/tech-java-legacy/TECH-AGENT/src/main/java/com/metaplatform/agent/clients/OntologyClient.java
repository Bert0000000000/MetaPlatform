package com.metaplatform.agent.clients;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.config.AgentProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;

@Component
public class OntologyClient {
    private static final TypeReference<Map<String,Object>> MAP = new TypeReference<>() {};
    private final WebClient client;
    private final AgentProperties properties;
    private final ObjectMapper mapper;

    public OntologyClient(@Qualifier("ontologyWebClient") WebClient client, AgentProperties properties, ObjectMapper mapper) {
        this.client=client; this.properties=properties; this.mapper=mapper;
    }

    public Map<String,Object> invokeGroundTool(String toolName, String envelopeId, Map<String,Object> input,
                                                String tenantId, String traceId) {
        if (properties.getOntologyBaseUrl()==null || properties.getOntologyBaseUrl().isBlank())
            return Map.of("status","ONTOLOGY_CLIENT_DISABLED","toolName",toolName);
        try {
            String json=client.post().uri("/agent/ground-tools/{toolName}",toolName)
                    .header("X-Tenant-Id",tenantId).header("X-Trace-Id",traceId==null?"":traceId)
                    .header(HttpHeaders.CONTENT_TYPE,"application/json")
                    .bodyValue(Map.of("envelopeId",envelopeId,"input",input)).retrieve()
                    .bodyToMono(String.class).block();
            if (json==null || json.length()>262144) throw Phase1Exception.badRequest("TOOL_RESULT_TOO_LARGE","Ontology result exceeds 256KB");
            return mapper.readValue(json,MAP);
        } catch (Phase1Exception ex) { throw ex; }
        catch (Exception ex) { throw new Phase1Exception("ONTOLOGY_UNAVAILABLE",org.springframework.http.HttpStatus.BAD_GATEWAY,ex.getMessage()); }
    }
}
