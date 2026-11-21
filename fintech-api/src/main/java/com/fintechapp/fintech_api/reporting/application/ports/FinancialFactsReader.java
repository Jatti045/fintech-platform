package com.fintechapp.fintech_api.reporting.application.ports;

import com.fintechapp.fintech_api.reporting.domain.FinancialFacts;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Actor;
import java.time.YearMonth;
import java.util.Optional;

public interface FinancialFactsReader {
  Optional<Actor> findActor(String ownerId);

  FinancialFacts read(String ownerId, YearMonth period);
}
