package com.joao_v_marques.portal_atendimento;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class PortalAtendimentoApplication {

	public static void main(String[] args) {
		SpringApplication.run(PortalAtendimentoApplication.class, args);
	}

}
