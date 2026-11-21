package com.fintechapp.fintech_api.controller;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.ChangePasswordRequest;
import com.fintechapp.fintech_api.dto.user.ProfilePictureUploadResponse;
import com.fintechapp.fintech_api.dto.user.UpdateCurrencyRequest;
import com.fintechapp.fintech_api.dto.user.UpdateMonthlyIncomeRequest;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @DeleteMapping("/{userId}")
  public ApiMessageResponse deleteAccount(
      @PathVariable String userId, @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
    return userService.deleteAccount(userId, authenticatedUser);
  }

  @PostMapping(
      path = "/{userId}/profile-picture",
      consumes = {"multipart/form-data"})
  public ResponseEntity<ProfilePictureUploadResponse> uploadProfilePicture(
      @PathVariable String userId,
      @RequestParam("profilePicture") MultipartFile file,
      @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
    ProfilePictureUploadResponse updatedUser =
        userService.uploadProfilePicture(userId, file, authenticatedUser);
    return ResponseEntity.ok(updatedUser);
  }

  @DeleteMapping("/{userId}/profile-picture")
  public UserDataResponse deleteProfilePicture(
      @PathVariable String userId, @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
    return userService.deleteProfilePicture(userId, authenticatedUser);
  }

  @PatchMapping("/me/password")
  public ApiMessageResponse changePassword(
      @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
      @Valid @RequestBody ChangePasswordRequest request) {
    return userService.changePassword(authenticatedUser, request);
  }

  @PatchMapping("/me/currency")
  public UserDataResponse updateCurrency(
      @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
      @Valid @RequestBody UpdateCurrencyRequest request) {
    return userService.updateCurrency(authenticatedUser, request);
  }

  @PatchMapping("/me/monthly-income")
  public UserDataResponse updateMonthlyIncome(
      @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
      @Valid @RequestBody UpdateMonthlyIncomeRequest request) {
    return userService.updateMonthlyIncome(authenticatedUser, request);
  }
}
