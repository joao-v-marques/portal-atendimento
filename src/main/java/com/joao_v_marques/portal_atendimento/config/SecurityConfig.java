package com.joao_v_marques.portal_atendimento.config;

import com.joao_v_marques.portal_atendimento.security.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Cadastros auxiliares dos atendimentos (configurados em /configurar-atendimentos)
    private static final String[] LOOKUP_PATHS = {
            "/api/service-request-categories/**",
            "/api/service-request-channels/**",
            "/api/service-request-types/**",
            "/api/service-request-severities/**",
            "/api/service-request-status/**",
    };

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService, CustomUserDetailsService userDetailsService, ObjectMapper objectMapper) throws Exception {
        JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        RestAuthenticationEntryPoint restAuthenticationEntryPoint = new RestAuthenticationEntryPoint(objectMapper);
        RestAccessDeniedHandler restAccessDeniedHandler = new RestAccessDeniedHandler(objectMapper);

        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/login", "/api/auth/login", "/api/auth/logout", "/error", "/css/**", "/js/**").permitAll()

                        // Tela e API de administração: só ADMIN. O 403 fora de /api/** redireciona para home?erro=sem-acesso
                        .requestMatchers("/configuracoes").hasRole("ADMIN")
                        .requestMatchers("/api/users/**", "/api/user-roles/**").hasRole("ADMIN")

                        // Controle de atendimentos: só ADMIN e colaboradores do relacionamento.
                        // Não casa com /api/service-request-status etc.: os cadastros auxiliares seguem para qualquer logado
                        .requestMatchers("/controlar-atendimentos", "/registrar-atendimento", "/configurar-atendimentos", "/api/service-requests/**").hasAnyRole("ADMIN", "EMPLOYEE_RELATIONSHIP")

                        // Cadastros auxiliares: leitura para qualquer logado (preenchem os selects), escrita só para quem configura
                        .requestMatchers(HttpMethod.POST, LOOKUP_PATHS).hasAnyRole("ADMIN", "EMPLOYEE_RELATIONSHIP")
                        .requestMatchers(HttpMethod.PUT, LOOKUP_PATHS).hasAnyRole("ADMIN", "EMPLOYEE_RELATIONSHIP")
                        .requestMatchers(HttpMethod.PATCH, LOOKUP_PATHS).hasAnyRole("ADMIN", "EMPLOYEE_RELATIONSHIP")

                        // Autorizações: o colaborador do relacionamento só usa Início e o registro de atendimentos
                        .requestMatchers("/autorizacoes", "/lancar-autorizacao",
                                "/api/authorization-requests/**", "/api/authorization-status/**", "/api/authorization-types/**").hasAnyRole("ADMIN", "EMPLOYEE_SERVICE")

                        // Pesquisa de satisfação: só ADMIN e gestores do atendimento (tela, listagem, dashboard e exportação)
                        .requestMatchers("/pesquisa-satisfacao", "/api/satisfaction-surveys/**").hasAnyRole("ADMIN", "MANAGER_SERVICE")

                        .anyRequest().authenticated())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthenticationEntryPoint)
                        .accessDeniedHandler(restAccessDeniedHandler))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationProvider authenticationProvider(CustomUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
