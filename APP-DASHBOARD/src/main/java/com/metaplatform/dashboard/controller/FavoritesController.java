package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.entity.FavoriteEntity;
import com.metaplatform.dashboard.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/favorites")
@RequiredArgsConstructor
public class FavoritesController {
    private final FavoriteService service;
    @GetMapping public List<FavoriteEntity> list(@RequestParam String userId) { return service.list(userId); }
    @PostMapping public FavoriteEntity add(@RequestParam String userId, @RequestBody FavoriteEntity favorite) { return service.add(userId, favorite); }
    @DeleteMapping("/{id}") public void delete(@PathVariable Long id) { service.delete(id); }
}
