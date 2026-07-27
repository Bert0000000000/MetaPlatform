package com.metaplatform.agent.native_;
import com.metaplatform.agent.middleware.ToolCall;
import lombok.Data;
import java.util.List;
import java.util.Map;
@Data public class NativeRunRequest { private Map<String,Object> context; private List<ToolCall> toolCalls; }
