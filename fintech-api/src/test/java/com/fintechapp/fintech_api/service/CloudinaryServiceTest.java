package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;

class CloudinaryServiceTest {
    @Test
    void absentAssetCompletesCleanupButUnconfirmedDeletionFails() throws Exception {
        Cloudinary cloudinary = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.destroy(eq("obsolete"), argThat(options -> Boolean.TRUE.equals(options.get("invalidate")))))
                .thenReturn(Map.of("result", "not found"), Map.of("result", "unexpected"));
        var service = new CloudinaryService(cloudinary, "profiles");

        assertDoesNotThrow(() -> service.deleteImage("obsolete"));
        assertThrows(IllegalStateException.class, () -> service.deleteImage("obsolete"));
    }
}
