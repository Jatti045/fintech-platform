package com.fintechapp.fintech_api.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;

import com.fintechapp.fintech_api.dto.auth.*;
import com.fintechapp.fintech_api.model.AuthProvider;
import com.google.api.client.auth.openidconnect.IdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.model.PasswordResetToken;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PasswordResetTokenRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.security.JwtService;

@Service
public class AuthService {

    @Value("${GOOGLE_ANDROID_CLIENT_ID}")
    private String googleClientId;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final MonthlyIncomeService monthlyIncomeService;

    public AuthService(
            UserRepository userRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            MonthlyIncomeService monthlyIncomeService) {
        this.userRepository = userRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.monthlyIncomeService = monthlyIncomeService;
    }

    @Transactional
    public GoogleAuthResponse googleAuth(GoogleAuthRequest request) throws Exception {

        String idToken = request.idToken();

        if (!StringUtils.hasText(idToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(), new GsonFactory()).setAudience(Collections.singletonList(googleClientId))
                .build();

        GoogleIdToken googleToken = verifier.verify(request.idToken());

        if (googleToken == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ID token.");
        }

        GoogleIdToken.Payload googlePayload = googleToken.getPayload();
        String email = googlePayload.getEmail();

        Optional<User> existingUser = userRepository.findByEmail(email);

        if (existingUser.isEmpty()) {
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setUsername(googlePayload.get("name").toString());
            newUser.setPassword(null);
            newUser.setAuthProvider(AuthProvider.GOOGLE);
            userRepository.save(newUser);
        }

        User user = userRepository.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User creation failed."));

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        LoginData data = new LoginData(toUserSummary(user), token);
        return new GoogleAuthResponse(true, "Login successful.", data);
    }

    @Transactional
    public UserDataResponse signup(SignupRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All fields are required.");
        }

        String email = normalizeEmail(request.email());
        if (!StringUtils.hasText(request.username()) || !StringUtils.hasText(request.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All fields are required.");
        }

        if (!request.password().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
        }

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User already exists.");
        }

        User user = new User();
        user.setUsername(request.username().trim());
        user.setEmail(email);
        user.setAuthProvider(AuthProvider.EMAIL);
        user.setPassword(passwordEncoder.encode(request.password()));

        User savedUser = userRepository.save(user);
        return new UserDataResponse(true, "User created successfully.", toUserSummary(savedUser));
    }

    public LoginResponse login(LoginRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        String email = normalizeEmail(request.email());
        if (!StringUtils.hasText(request.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "User with email " + email + " does not exist. Please sign up first."));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid credentials.");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        LoginData data = new LoginData(toUserSummary(user), token);
        return new LoginResponse(true, "Login successful.", data);
    }

    @Transactional
    public ApiMessageResponse forgotPassword(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String hashedOtp = passwordEncoder.encode(otp);

        PasswordResetToken token = new PasswordResetToken();
        token.setToken(hashedOtp);
        token.setUser(user);
        token.setExpiresAt(Instant.now().plusSeconds(15 * 60));

        passwordResetTokenRepository.deleteByExpiresAtBefore(Instant.now());
        passwordResetTokenRepository.save(token);

        String subject = "Password reset code";
        String text = "Your password reset code is: " + otp + ". It expires in 15 minutes.";
        emailService.sendEmail(email, subject, text);

        return new ApiMessageResponse(true, "Reset code sent to email.");
    }

    @Transactional
    public ApiMessageResponse resetPassword(ResetPasswordRequest request) {
        if (request == null || !StringUtils.hasText(request.otp())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and code are required.");
        }

        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        AuthProvider authProvider = user.getAuthProvider();

        if (authProvider.equals(AuthProvider.GOOGLE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password reset not allowed for " + authProvider + " accounts.");
        }

        PasswordResetToken latestToken = passwordResetTokenRepository
                .findFirstByUser_IdOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "No reset token found. Please request a new code."));

        if (latestToken.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reset token has expired. Please request a new code.");
        }

        if (!passwordEncoder.matches(request.otp(), latestToken.getToken())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid reset code.");
        }

        if (request.isVerifyOnly()) {
            return new ApiMessageResponse(true, "Code verified.");
        }

        if (!StringUtils.hasText(request.newPassword()) || !StringUtils.hasText(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New passwords are required.");
        }

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        passwordResetTokenRepository.deleteByUser_Id(user.getId());

        return new ApiMessageResponse(true, "Password reset successful.");
    }

    private String normalizeEmail(String rawEmail) {
        if (!StringUtils.hasText(rawEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        }

        return rawEmail.trim().toLowerCase(Locale.ROOT);
    }

    private UserSummaryResponse toUserSummary(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getProfilePic(),
                user.getCurrency(),
                monthlyIncomeService.resolveForCurrentMonth(user),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
