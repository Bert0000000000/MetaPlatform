package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.AskRequest;
import com.metaplatform.dashboard.dto.DeliverableStatsResponse;
import com.metaplatform.dashboard.entity.DeliverableEntity;
import com.metaplatform.dashboard.service.DeliverableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/deliverables")
@RequiredArgsConstructor
public class DeliverablesController {

    private final DeliverableService deliverableService;

    @GetMapping
    public Page<DeliverableEntity> list(
            @RequestParam String userId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return deliverableService.list(userId, type, tag, keyword, page, size);
    }

    @GetMapping("/{deliverableId}")
    public DeliverableEntity get(@PathVariable String deliverableId) {
        return deliverableService.getById(deliverableId);
    }

    @GetMapping("/{deliverableId}/content")
    public String getContent(@PathVariable String deliverableId) {
        return deliverableService.getContent(deliverableId);
    }

    @GetMapping("/{deliverableId}/download")
    public ResponseEntity<byte[]> download(@PathVariable String deliverableId) {
        byte[] data = deliverableService.download(deliverableId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=deliverable-" + deliverableId + ".txt");
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @PostMapping("/{deliverableId}/share")
    public DeliverableEntity share(@PathVariable String deliverableId) {
        return deliverableService.share(deliverableId);
    }

    @GetMapping("/shared/{shareToken}")
    public DeliverableEntity getByShareToken(@PathVariable String shareToken) {
        return deliverableService.getByShareToken(shareToken);
    }

    @PostMapping("/{deliverableId}/ask")
    public String ask(@PathVariable String deliverableId, @Valid @RequestBody AskRequest request) {
        return deliverableService.ask(deliverableId, request);
    }

    @PutMapping("/{deliverableId}/archive")
    public DeliverableEntity archive(@PathVariable String deliverableId) {
        return deliverableService.archive(deliverableId);
    }

    @DeleteMapping("/{deliverableId}")
    public void delete(@PathVariable String deliverableId) {
        deliverableService.delete(deliverableId);
    }

    @GetMapping("/search")
    public Page<DeliverableEntity> search(
            @RequestParam String userId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return deliverableService.search(userId, keyword, page, size);
    }

    @GetMapping("/tags")
    public List<String> tags(@RequestParam String userId) {
        return deliverableService.tags(userId);
    }

    @GetMapping("/stats")
    public DeliverableStatsResponse stats(@RequestParam String userId) {
        return deliverableService.stats(userId);
    }
}
