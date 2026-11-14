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

    private final ProfileImageCleanupJobs cleanup;

    public ProfilePictureStore(UserRepository users, ProfileImageCleanupJobs cleanup) {
        this.users = users;
        this.cleanup = cleanup;
    }

    @Transactional
    public User replace(String userId, String url, String publicId) {
        User user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        String previousPublicId = user.getProfilePicPublicId();
        user.setProfilePic(url);
        user.setProfilePicPublicId(publicId);
        // Flush for the generated timestamp/version and to surface failures before cleanup.
        users.saveAndFlush(user);
        if (!java.util.Objects.equals(previousPublicId, publicId)) cleanup.enqueue(previousPublicId);
        return user;
    }
}
