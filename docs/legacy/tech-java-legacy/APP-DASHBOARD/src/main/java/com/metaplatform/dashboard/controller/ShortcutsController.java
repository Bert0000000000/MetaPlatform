package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.entity.ShortcutEntity;
import com.metaplatform.dashboard.service.ShortcutService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/shortcuts")
@RequiredArgsConstructor
public class ShortcutsController {
    private final ShortcutService service;
    @GetMapping public List<ShortcutEntity> list(@RequestParam String userId) { return service.list(userId); }
    @PutMapping public List<ShortcutEntity> replace(@RequestParam String userId, @RequestBody List<ShortcutEntity> shortcuts) { return service.replace(userId, shortcuts); }
}
