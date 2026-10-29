package com.fintechapp.fintech_api.service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.ChangePasswordRequest;
import com.fintechapp.fintech_api.dto.user.ProfilePictureUploadResponse;
import com.fintechapp.fintech_api.dto.user.ProfilePictureUserResponse;
import com.fintechapp.fintech_api.dto.user.UpdateCurrencyRequest;
import com.fintechapp.fintech_api.dto.user.UpdateMonthlyIncomeRequest;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.PasswordResetTokenRepository;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;

@Service
public class UserService {

    @org.springframework.beans.factory.annotation.Autowired private com.fintechapp.fintech_api.repository.CategorizationRuleRepository categorizationRules;
    @org.springframework.beans.factory.annotation.Autowired private com.fintechapp.fintech_api.repository.RuleApplicationRepository ruleApplications;
    @org.springframework.beans.factory.annotation.Autowired private com.fintechapp.fintech_api.repository.PendingClassificationHandoffRepository pendingChoices;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final PlaidItemRepository plaidItemRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final MonthlyIncomeService monthlyIncomeService;
    private final IncomeCalculationService incomeCalculationService;
    private final PasswordEncoder passwordEncoder;
    private final CloudinaryService cloudinaryService;
    private final UploadValidationService uploadValidationService;
    private final ProfilePictureStore profilePictures;
    private final FinancialCacheInvalidator cacheInvalidator;
    private final PlaidRevocationJobService revocations;

    public UserService(
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            PlaidItemRepository plaidItemRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            MonthlyIncomeService monthlyIncomeService,
            IncomeCalculationService incomeCalculationService,
            PasswordEncoder passwordEncoder,
            CloudinaryService cloudinaryService,
            UploadValidationService uploadValidationService,
            FinancialCacheInvalidator cacheInvalidator,
            ProfilePictureStore profilePictures,
            PlaidRevocationJobService revocations) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.plaidItemRepository = plaidItemRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.monthlyIncomeService = monthlyIncomeService;
        this.incomeCalculationService = incomeCalculationService;
        this.passwordEncoder = passwordEncoder;
        this.cloudinaryService = cloudinaryService;
        this.uploadValidationService = uploadValidationService;
        this.cacheInvalidator = cacheInvalidator;
        this.profilePictures = profilePictures;
        this.revocations = revocations;
    }

    public UserDataResponse getCurrentUser(AuthenticatedUser authenticatedUser) {
        User user = requireCurrentUser(authenticatedUser);
        return new UserDataResponse(true, "Current user fetched successfully.", toUserSummary(user));
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public UserDataResponse getMonthlyIncomeForMonth(
            AuthenticatedUser authenticatedUser,
            String monthRaw,
            String yearRaw) {
        User user = requireCurrentUser(authenticatedUser);

        Integer month = parseInteger(monthRaw);
        Integer year = parseInteger(yearRaw);
        if (month == null || year == null || month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        return new UserDataResponse(
                true,
                "Monthly income fetched successfully.",
                toUserSummary(user, year, month));
    }

    @Transactional
    public ApiMessageResponse deleteAccount(String userId, AuthenticatedUser authenticatedUser) {
        requireSameUser(userId, authenticatedUser);
        User existingUser = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        // The outbox and local deletion commit together; never discard cleanup credentials.
        plaidItemRepository.flush();
        revocations.enqueueForUser(userId);

        if (pendingChoices != null) pendingChoices.deleteByUser_Id(userId);
        if (ruleApplications != null) ruleApplications.deleteByUser_Id(userId);
        if (categorizationRules != null) categorizationRules.deleteByUser_Id(userId);
        transactionRepository.deleteByUser_Id(userId);
        budgetRepository.deleteByUser_Id(userId);
        passwordResetTokenRepository.deleteByUser_Id(userId);
        plaidItemRepository.deleteByUser_Id(userId);
        monthlyIncomeService.deleteByUserId(userId);
        userRepository.delete(existingUser);

        // Drop the deleted user's cached aggregates (hygiene; entries would
        // otherwise only expire via TTL).
        cacheInvalidator.evictFinancialSummaryRegion(userId);
        cacheInvalidator.evictRecurringPayments(userId);

        return new ApiMessageResponse(true,
                "User account deleted. Any pending bank revocations will continue in the background.");
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProfilePictureUploadResponse uploadProfilePicture(String userId, MultipartFile file,
            AuthenticatedUser authenticatedUser) {
        requireSameUser(userId, authenticatedUser);
        uploadValidationService.validateProfilePicture(file);
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }

        CloudinaryService.UploadedImage uploaded = cloudinaryService.uploadProfileImage(file, userId);
        ProfilePictureStore.Change change;
        try {
            // Reload and lock after upload; no pre-upload User snapshot is written back.
            change = profilePictures.replace(userId, uploaded.url(), uploaded.publicId());
        } catch (RuntimeException failure) {
            cloudinaryService.deleteImage(uploaded.publicId());
            throw failure;
        }
        // The store has committed. Clean up the asset actually replaced under its lock.
        if (StringUtils.hasText(change.previousPublicId()) && !change.previousPublicId().equals(uploaded.publicId())) {
            cloudinaryService.deleteImage(change.previousPublicId());
        }
        return new ProfilePictureUploadResponse(true, "Profile picture uploaded successfully.",
                toProfilePictureUser(change.user()));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public UserDataResponse deleteProfilePicture(String userId, AuthenticatedUser authenticatedUser) {
        requireSameUser(userId, authenticatedUser);
        ProfilePictureStore.Change change = profilePictures.replace(userId, null, null);
        cloudinaryService.deleteImage(change.previousPublicId());
        return new UserDataResponse(true, "Profile picture deleted.", toUserSummary(change.user()));
    }

    @Transactional
    public ApiMessageResponse changePassword(AuthenticatedUser authenticatedUser, ChangePasswordRequest request) {
        // Serialize with recovery and login; recheck a token admitted before another password change.
        User user = requireLockedCurrentUser(authenticatedUser);
        if (authenticatedUser.sessionVersion() != user.getSessionVersion()) {
            throw new com.fintechapp.fintech_api.security.TokenAuthenticationException(
                    HttpStatus.UNAUTHORIZED, "Session has been revoked. Please sign in again.");
        }

        if (request == null
                || !StringUtils.hasText(request.currentPassword())
                || !StringUtils.hasText(request.newPassword())
                || !StringUtils.hasText(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All password fields are required.");
        }

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New passwords do not match.");
        }

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
        }

        userRepository.replacePasswordAndRevokeSessions(user.getId(), passwordEncoder.encode(request.newPassword()));
        passwordResetTokenRepository.deleteByUser_Id(user.getId());
        return new ApiMessageResponse(true, "Password changed successfully.");
    }

    @Transactional
    public UserDataResponse updateCurrency(AuthenticatedUser authenticatedUser, UpdateCurrencyRequest request) {
        // Share the financial writers' user-row lock before reading currency or checking state.
        User user = requireLockedCurrentUser(authenticatedUser);
        if (request == null || !StringUtils.hasText(request.currency())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency code is required.");
        }

        String normalizedCurrency = request.currency().trim().toUpperCase(Locale.ROOT);
        if (!normalizedCurrency.matches("^[A-Z]{3}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency code");
        }

        if (!normalizedCurrency.equals(user.getCurrency())) {
            if (transactionRepository.existsByUser_Id(user.getId())
                    || budgetRepository.existsByUser_Id(user.getId())
                    || monthlyIncomeService.existsForUser(user.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Cannot change currency after financial data exists (transactions, budgets, or monthly income).");
            }

            user.setCurrency(normalizedCurrency);
            User updatedUser = userRepository.save(user);

            cacheInvalidator.evictFinancialSummaryRegion(user.getId());
            cacheInvalidator.evictRecurringPayments(user.getId());

            return new UserDataResponse(true, "Currency updated successfully.", toUserSummary(updatedUser));
        }

        return new UserDataResponse(true, "Currency updated successfully.", toUserSummary(user));
    }

    @Transactional
    public UserDataResponse updateMonthlyIncome(
            AuthenticatedUser authenticatedUser,
            UpdateMonthlyIncomeRequest request) {
        User user = requireLockedCurrentUser(authenticatedUser);
        if (request == null || request.monthlyIncome() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monthly income is required.");
        }

        if (request.monthlyIncome() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monthly income must be a non-negative number.");
        }

        Integer month = request.month();
        Integer year = request.year();
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year are required");
        }

        monthlyIncomeService.upsertForMonth(user, year, month, request.monthlyIncome());

        // The income baseline feeds the summary of the target month and every
        // later month ("latest monthStart <= target"), so evict the whole
        // user's summary region rather than guessing the affected months.
        cacheInvalidator.evictFinancialSummaryRegion(user.getId());

        return new UserDataResponse(true, "Monthly income updated successfully.", toUserSummary(user, year, month));
    }

    private User requireLockedCurrentUser(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return userRepository.findByIdForUpdate(authenticatedUser.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private User requireCurrentUser(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        return userRepository.findById(authenticatedUser.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private void requireSameUser(String userId, AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        if (!authenticatedUser.userId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    private UserSummaryResponse toUserSummary(User user) {
        LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);
        return toUserSummary(user, utcNow.getYear(), utcNow.getMonthValue() - 1);
    }

    private UserSummaryResponse toUserSummary(User user, int year, int month) {
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

    private Integer parseInteger(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }

        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private ProfilePictureUserResponse toProfilePictureUser(User user) {
        return new ProfilePictureUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getProfilePic(),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }

}
