package com.metaplatform.dialogue.interfaces.rest;

import com.metaplatform.dialogue.application.IntentService;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import com.metaplatform.dialogue.interfaces.rest.dto.IntentResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 意图 REST 控制器。提供意图注册和查询的 API。
 */
@RestController
@RequestMapping("/api/v1/intents")
public class IntentController {

    private final IntentService intentService;

    public IntentController(IntentService intentService) {
        this.intentService = intentService;
    }

    /**
     * GET /api/v1/intents - 获取所有意图
     */
    @GetMapping
    public ResponseEntity<List<IntentResponse>> listIntents(
            @RequestParam(required = false) IntentCategory category) {
        List<Intent> intents;
        if (category != null) {
            intents = intentService.findByCategory(category);
        } else {
            intents = intentService.findAll();
        }
        return ResponseEntity.ok(intents.stream()
                .map(IntentResponse::from)
                .toList());
    }

    /**
     * GET /api/v1/intents/{id} - 获取意图详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<IntentResponse> getIntent(@PathVariable String id) {
        try {
            Intent intent = intentService.findById(id);
            return ResponseEntity.ok(IntentResponse.from(intent));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/v1/intents - 注册新意图
     */
    @PostMapping
    public ResponseEntity<IntentResponse> registerIntent(@RequestBody Intent intent) {
        Intent saved = intentService.register(intent);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(IntentResponse.from(saved));
    }

    /**
     * DELETE /api/v1/intents/{id} - 删除意图
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIntent(@PathVariable String id) {
        try {
            intentService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
