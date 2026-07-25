package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class McpTransportTest {

    @Test
    void protocolServiceHandlesInitialize() {
        McpProtocolService service = new McpProtocolService(
                null, null, null, new ObjectMapper(), null, null, null);
        JsonRpcRequest request = new JsonRpcRequest();
        request.setId(1);
        request.setMethod("initialize");

        JsonRpcResponse response = service.handle(request);

        assertThat(response.getError()).isNull();
        assertThat(response.getResult()).isNotNull();
    }

    @Test
    void stdioWritesOneJsonRpcResponsePerInputLine() throws Exception {
        McpProtocolService service = new McpProtocolService(
                null, null, null, new ObjectMapper(), null, null, null);
        var input = new ByteArrayInputStream(
                "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}\n"
                        .getBytes(StandardCharsets.UTF_8));
        var output = new ByteArrayOutputStream();

        new com.metaplatform.mcp.stdio.McpStdioServerLauncher(
                service, new ObjectMapper(), input, output).run();

        assertThat(output.toString(StandardCharsets.UTF_8))
                .contains("\"jsonrpc\":\"2.0\"")
                .contains("\"id\":1");
    }
}
