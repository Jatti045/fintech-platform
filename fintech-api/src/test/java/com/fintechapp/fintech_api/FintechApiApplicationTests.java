package com.fintechapp.fintech_api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(properties = "app.jwt.secret-key=test-secret-key-test-secret-key-1234567890")
class FintechApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
