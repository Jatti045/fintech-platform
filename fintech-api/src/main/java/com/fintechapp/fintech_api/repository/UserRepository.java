package com.fintechapp.fintech_api.repository;

import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fintechapp.fintech_api.model.User;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :userId")
    Optional<User> findByIdForUpdate(@Param("userId") String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.email = :email")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    Optional<User> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = :email")
    java.util.List<User> findAllByEmailForGoogleUpdate(@Param("email") String normalizedEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.googleSubject = :subject")
    Optional<User> findByGoogleSubjectForUpdate(@Param("subject") String subject);

    /** Never replace an established identity or let an ordinary entity merge bind one. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE users SET google_subject = :subject, session_version = session_version + 1, "
            + "update_version = update_version + 1, updated_at = clock_timestamp() "
            + "WHERE id = :userId AND google_subject IS NULL", nativeQuery = true)
    int bindGoogleSubject(@Param("userId") String userId, @Param("subject") String subject);

    // Scalar lookup intentionally bypasses managed User snapshots and any financial cache.
    @Query("SELECT u.sessionVersion FROM User u WHERE u.id = :userId")
    Optional<Long> findSessionVersionById(@Param("userId") String userId);

    /** Caller holds the user row lock. Password and revocation commit as one database update. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE users SET password = :password, session_version = session_version + 1, "
            + "update_version = update_version + 1, updated_at = clock_timestamp() WHERE id = :userId", nativeQuery = true)
    int replacePasswordAndRevokeSessions(@Param("userId") String userId, @Param("password") String password);

    boolean existsByEmail(String email);
}

