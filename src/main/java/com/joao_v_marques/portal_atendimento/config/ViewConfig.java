package com.joao_v_marques.portal_atendimento.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ViewConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/home").setViewName("home");
        registry.addViewController("/login").setViewName("login");
        registry.addViewController("/pesquisa-satisfacao").setViewName("satisfaction_survey");
        registry.addViewController("/autorizacoes").setViewName("authorizations");
        registry.addViewController("/lancar-autorizacao").setViewName("new_authorization");
        registry.addViewController("/configuracoes").setViewName("settings");
        registry.addViewController("/controlar-atendimentos").setViewName("service_requests");
        registry.addViewController("/registrar-atendimento").setViewName("new_service_request");
        registry.addViewController("/configurar-atendimentos").setViewName("service_request_settings");
    }
}
