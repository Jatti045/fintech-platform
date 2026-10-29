package com.fintechapp.fintech_api.service;

import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Short persistence boundary; cloud operations must happen after this transaction completes. */
@Service
public class ProfilePictureStore {
    private final UserRepository users;

    public ProfilePictureStore(UserRepository users) {
        this.users = users;
    }

    public record Change(User user, String previousPublicId) { }

    @Transactional
    public Change replace(String userId, String url, String publicId) {
        User user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        String previousPublicId = user.getProfilePicPublicId();
        user.setProfilePic(url);
        user.setProfilePicPublicId(publicId);
        // Flush for the generated timestamp/version and to surface failures before cleanup.
        users.saveAndFlush(user);
        return new Change(user, previousPublicId);
    }
}
