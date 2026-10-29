package com.fintechapp.fintech_api.controller;
import com.fintechapp.fintech_api.dto.auth.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import com.fintechapp.fintech_api.security.RecoveryClientSource;

import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.service.AuthService;
import com.fintechapp.fintech_api.service.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;
	private final UserService userService;
	private final RecoveryClientSource clientSource;

	public AuthController(AuthService authService, UserService userService, RecoveryClientSource clientSource) {
		this.authService = authService;
		this.userService = userService;
		this.clientSource = clientSource;
	}

	@PostMapping("/google")
	public GoogleAuthResponse googleAuth(@RequestBody GoogleAuthRequest request) throws Exception {
		return authService.googleAuth(request);
	}

	@PostMapping({ "/register", "/signup" })
	@ResponseStatus(HttpStatus.CREATED)
	public UserDataResponse signup(@Valid @RequestBody SignupRequest request) {
		return authService.signup(request);
	}

	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@PostMapping("/forgot-password")
	public ApiMessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest httpRequest) {
		return authService.forgotPassword(request.email(), clientSource.resolve(httpRequest));
	}

	@PostMapping("/reset-password")
	public ApiMessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
		return authService.resetPassword(request, clientSource.resolve(httpRequest));
	}

	@GetMapping("/me")
	public UserDataResponse getCurrentUser(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return userService.getCurrentUser(authenticatedUser);
	}
}
