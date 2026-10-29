package com.fintechapp.fintech_api.service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;

import com.fintechapp.fintech_api.dto.auth.*;
import com.fintechapp.fintech_api.model.AuthProvider;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.security.JwtService;

@Service
public class AuthService {

    @Value("${GOOGLE_ANDROID_CLIENT_ID}")
    private String googleClientId;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final IncomeCalculationService incomeCalculationService;
    private final PasswordRecoveryService passwordRecovery;
    private final PasswordRecoveryRateLimiter recoveryLimits;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            IncomeCalculationService incomeCalculationService,
            PasswordRecoveryService passwordRecovery,
            PasswordRecoveryRateLimiter recoveryLimits) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.incomeCalculationService = incomeCalculationService;
        this.passwordRecovery = passwordRecovery;
        this.recoveryLimits = recoveryLimits;
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

        Optional<User> existingUser = userRepository.findByEmailForUpdate(email);

        if (existingUser.isEmpty()) {
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setUsername(googlePayload.get("name").toString());
            newUser.setPassword(null);
            newUser.setAuthProvider(AuthProvider.GOOGLE);
            userRepository.save(newUser);
        }

        User user = userRepository.findByEmailForUpdate(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User creation failed."));

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getSessionVersion());
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

        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            // Two signups for the same email can race past the existsByEmail
            // check; the unique index catches the loser. Surface it as the same
            // business error instead of a 500.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User already exists.");
        }
        return new UserDataResponse(true, "User created successfully.", toUserSummary(user));
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        String email = normalizeEmail(request.email());
        if (!StringUtils.hasText(request.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        User user = userRepository.findByEmailForUpdate(email).orElse(null);
        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            // Deliberately identical to the wrong-password case so the endpoint
            // cannot be used to enumerate which emails have accounts.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid email or password.");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getSessionVersion());
        LoginData data = new LoginData(toUserSummary(user), token);
        return new LoginResponse(true, "Login successful.", data);
    }

    public ApiMessageResponse forgotPassword(String rawEmail, String clientSource) {
        String email = normalizeEmail(rawEmail);
        if (recoveryLimits.allowRequest(email, clientSource)) {
            passwordRecovery.issueCode(email);
        }
        return PasswordRecoveryService.REQUEST_RESPONSE;
    }

    public ApiMessageResponse resetPassword(ResetPasswordRequest request, String clientSource) {
        if (request == null || !StringUtils.hasText(request.otp())) {
            throw PasswordRecoveryService.invalidCode();
        }
        String email = normalizeEmail(request.email());
        recoveryLimits.checkVerification(email, clientSource);
        return passwordRecovery.verify(email, request);
    }

    private String normalizeEmail(String rawEmail) {
        if (!StringUtils.hasText(rawEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        }

        return rawEmail.trim().toLowerCase(Locale.ROOT);
    }

    private UserSummaryResponse toUserSummary(User user) {
        LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);
        int year = utcNow.getYear();
        int month = utcNow.getMonthValue() - 1;
        double expectedIncome = incomeCalculationService.resolveExpectedForMonth(user, year, month);
        double actualIncome = incomeCalculationService.resolveActualForMonth(user, year, month);
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getProfilePic(),
                user.getCurrency(),
                expectedIncome,
                actualIncome,
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
