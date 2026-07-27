package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.entity.FavoriteEntity;
import com.metaplatform.dashboard.repository.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository repository;
    public List<FavoriteEntity> list(String userId) { return repository.findByUserIdOrderByCreatedAtDesc(userId); }
    public FavoriteEntity add(String userId, FavoriteEntity favorite) { favorite.setId(null); favorite.setUserId(userId); return repository.save(favorite); }
    public void delete(Long id) { repository.deleteById(id); }
}
