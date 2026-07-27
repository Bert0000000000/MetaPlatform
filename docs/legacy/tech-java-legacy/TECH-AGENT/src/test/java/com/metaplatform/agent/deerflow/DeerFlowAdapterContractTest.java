package com.metaplatform.agent.deerflow;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class DeerFlowAdapterContractTest {
    private HttpServer server; private String baseUrl; private final ObjectMapper mapper = new ObjectMapper();
    @BeforeEach void startServer() throws IOException { server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0); server.start(); baseUrl="http://127.0.0.1:"+server.getAddress().getPort()+"/api"; }
    @AfterEach void stopServer(){server.stop(0);}
    @Test void startRunUsesPinnedGatewayContractAndServiceIdentity() throws Exception {
        AtomicReference<HttpExchange> seen=new AtomicReference<>(); AtomicReference<Map<String,Object>> body=new AtomicReference<>();
        server.createContext("/api/threads", e -> { if (e.getRequestURI().getPath().equals("/api/threads")) respond(e, 200, "{}"); else { seen.set(e); body.set(mapper.readValue(e.getRequestBody(), new TypeReference<>(){})); respond(e, 200, "{\"run_id\":\"df-run-1\",\"thread_id\":\"thread-1\",\"status\":\"pending\"}"); } });
        server.createContext("/api/threads/thread-1/runs",e->{seen.set(e);body.set(mapper.readValue(e.getRequestBody(),new TypeReference<>(){}));respond(e,200,"{\"run_id\":\"df-run-1\",\"thread_id\":\"thread-1\",\"status\":\"pending\"}");});
        String runId=adapter("shared-token").startRun(DeerFlowAdapter.StartRunRequest.builder().tenantId("tenant-a").userId("user-a").platformRunId("RUN-1").agentId("lead_agent").threadId("thread-1").traceId("trace-1").message("analyze customer").ontologyEnvelope(Map.of("envelopeId","ENV-1")).allowedTools(List.of("ontology.get_object")).build());
        assertEquals("df-run-1",runId); assertEquals("POST",seen.get().getRequestMethod());
        assertEquals("shared-token",seen.get().getRequestHeaders().getFirst("X-DeerFlow-Internal-Token")); assertEquals("owner-a",seen.get().getRequestHeaders().getFirst("X-DeerFlow-Owner-User-Id"));
        assertEquals("RUN-1",((Map<?,?>)body.get().get("metadata")).get("platform_run_id")); assertEquals("continue",body.get().get("on_disconnect")); assertEquals("create",body.get().get("if_not_exists"));
    }
    @Test void upstreamFailureIsTypedAndNeverReturnsNull(){ server.createContext("/api/threads",e->respond(e,200,"{}")); server.createContext("/api/threads/thread-1/runs",e->respond(e,401,"{\"detail\":\"unauthorized\"}")); DeerFlowException ex=assertThrows(DeerFlowException.class,()->adapter("wrong").startRun(DeerFlowAdapter.StartRunRequest.builder().tenantId("t").userId("u").agentId("a").threadId("thread-1").message("m").ontologyEnvelope(Map.of()).allowedTools(List.of()).build())); assertEquals("DEERFLOW_UPSTREAM_4XX",ex.getCode()); assertEquals(401,ex.getStatus()); }
    @Test void disabledRuntimeFailsExplicitly(){ DeerFlowProperties props=properties("token");props.setEnabled(false);DeerFlowAdapter adapter=new DeerFlowAdapter(props);assertEquals("DEERFLOW_DISABLED",assertThrows(DeerFlowException.class,()->adapter.startRun(DeerFlowAdapter.StartRunRequest.builder().threadId("t").build())).getCode());}
    private DeerFlowAdapter adapter(String token){return new DeerFlowAdapter(properties(token));}
    private DeerFlowProperties properties(String token){DeerFlowProperties p=new DeerFlowProperties();p.setGatewayUrl(baseUrl);p.setInternalToken(token);p.setOwnerUserId("owner-a");p.setEnabled(true);return p;}
    private static void respond(HttpExchange e,int status,String json)throws IOException{byte[] b=json.getBytes(StandardCharsets.UTF_8);e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(status,b.length);e.getResponseBody().write(b);e.close();}
}
