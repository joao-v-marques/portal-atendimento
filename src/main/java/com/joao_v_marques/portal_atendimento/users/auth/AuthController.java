package com.joao_v_marques.portal_atendimento.users.auth;

import com.joao_v_marques.portal_atendimento.security.JwtService;
import com.joao_v_marques.portal_atendimento.users.auth.dto.AuthRequest;
import com.joao_v_marques.portal_atendimento.users.auth.dto.AuthResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    private final boolean secureCookie;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService, @Value("${app.security.cookie-secure}") boolean secureCookie) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request, HttpServletRequest httpRequest) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        String token = jwtService.generateToken(request.username());

        ResponseCookie cookie = accessTokenCookie(token,
                Duration.ofMillis(jwtService.getExpirationMillis()),
                httpRequest.getContextPath());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(token));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {

        ResponseCookie cookie = accessTokenCookie("", Duration.ZERO, httpRequest.getContextPath());

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    private ResponseCookie accessTokenCookie(String value, Duration maxAge, String conextPath) {
        return ResponseCookie.from("access_token", value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path(conextPath)
                .maxAge(maxAge)
                .build();
    }
}
