package com.fintechapp.fintech_api.service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.cloudinary.Cloudinary;

@Service
public class CloudinaryService {

    private static final Map<String, Object> DELETE_OPTIONS = Map.of(
            "invalidate", true, "connect_timeout", 10_000,
            "connection_request_timeout", 10_000, "timeout", 30_000);

    private final Cloudinary cloudinary;
    private final String profileFolder;

    public CloudinaryService(
            Cloudinary cloudinary,
            @Value("${app.cloudinary.profile-folder:profile-pictures}") String profileFolder
    ) {
        this.cloudinary = cloudinary;
        this.profileFolder = profileFolder;
    }

    public UploadedImage uploadProfileImage(MultipartFile file, String ownerId) {
        try {
            Map<String, Object> options = new HashMap<>();
            options.put("folder", profileFolder);
            options.put("resource_type", "image");
            options.put("transformation", "c_fill,g_face,h_400,w_400/q_auto,f_auto");
            options.put("public_id", profileFolder + "/" + ownerId + "-" + java.util.UUID.randomUUID());
            options.put("overwrite", false);
            options.put("invalidate", true);

            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);

            Object secureUrl = result.get("secure_url");
            Object publicId = result.get("public_id");
            if (!(secureUrl instanceof String url) || !(publicId instanceof String pid)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Cloudinary upload failed.");
            }

            return new UploadedImage(url, pid);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file.", ex);
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Cloudinary upload failed.", ex);
        }
    }

    public void deleteImage(String publicId) {
        if (publicId == null || publicId.isBlank()) {
            return;
        }

        try {
            var response = cloudinary.uploader().destroy(publicId, new HashMap<>(DELETE_OPTIONS));
            Object result = response == null ? null : response.get("result");
            if ("ok".equals(result) || "not found".equals(result)) return;
        } catch (Exception ex) {
            throw new IllegalStateException("Cloudinary image deletion failed");
        }
        throw new IllegalStateException("Cloudinary image deletion was not confirmed");
    }

    public record UploadedImage(String url, String publicId) {
    }
}
