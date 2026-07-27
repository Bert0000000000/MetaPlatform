package com.metaplatform.agent.tools;

import com.metaplatform.agent.api.Phase1Exception;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/agent/ground-tools")
@RequiredArgsConstructor
public class GroundToolController {
    private final GroundToolService groundToolService;

    @PostMapping("/{toolName}")
    public Map<String, Object> invoke(@PathVariable String toolName, @Valid @RequestBody GroundToolRequest request) {
        return groundToolService.invoke(toolName, request);
    }
}

