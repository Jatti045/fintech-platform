package com.fintechapp.fintech_api.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.service.CategorizationRuleService;

@RestController @RequestMapping("/api/categorization-rules")
public class CategorizationRuleController {
    private final CategorizationRuleService rules;
    public CategorizationRuleController(CategorizationRuleService rules) { this.rules=rules; }
    public record Result<T>(boolean success,T data) {}
    public record ApplyRequest(String token) {}
    @GetMapping public Result<?> list(@AuthenticationPrincipal AuthenticatedUser auth) { return new Result<>(true,rules.list(auth)); }
    @GetMapping("/applications") public Result<?> history(@AuthenticationPrincipal AuthenticatedUser auth) { return new Result<>(true,rules.history(auth)); }
    @GetMapping("/accounts") public Result<?> accounts(@AuthenticationPrincipal AuthenticatedUser auth) { return new Result<>(true,rules.accounts(auth)); }
    @PostMapping public Result<?> create(@AuthenticationPrincipal AuthenticatedUser auth,@Valid @RequestBody RuleRequest body) { return new Result<>(true,rules.save(auth,null,body)); }
    @PatchMapping("/{id}") public Result<?> edit(@AuthenticationPrincipal AuthenticatedUser auth,@PathVariable String id,@Valid @RequestBody RuleRequest body) { return new Result<>(true,rules.save(auth,id,body)); }
    @DeleteMapping("/{id}") public Result<?> delete(@AuthenticationPrincipal AuthenticatedUser auth,@PathVariable String id,@RequestParam long revision) { rules.delete(auth,id,revision); return new Result<>(true,null); }
    @PostMapping("/{id}/preview") public Result<?> preview(@AuthenticationPrincipal AuthenticatedUser auth,@PathVariable String id) { return new Result<>(true,rules.preview(auth,id)); }
    @PostMapping("/{id}/apply") public Result<?> apply(@AuthenticationPrincipal AuthenticatedUser auth,@PathVariable String id,@RequestBody ApplyRequest body) { return new Result<>(true,rules.apply(auth,id,body.token())); }
    @PostMapping("/applications/{id}/undo") public Result<?> undo(@AuthenticationPrincipal AuthenticatedUser auth,@PathVariable String id) { return new Result<>(true,rules.undo(auth,id)); }
}
