package com.fintechapp.fintech_api.repository;

import com.fintechapp.fintech_api.model.GoogleIdentityChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoogleIdentityChallengeRepository extends JpaRepository<GoogleIdentityChallenge, String> { }
