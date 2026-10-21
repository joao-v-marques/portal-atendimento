package com.joao_v_marques.portal_atendimento.service_requests.severity;

import com.joao_v_marques.portal_atendimento.service_requests.severity.dto.ServiceRequestSeverityRequest;
import com.joao_v_marques.portal_atendimento.service_requests.severity.dto.ServiceRequestSeverityResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-request-severities")
public class ServiceRequestSeverityController {

    private final ServiceRequestSeverityService serviceRequestSeverityService;

    public ServiceRequestSeverityController(ServiceRequestSeverityService serviceRequestSeverityService) {
        this.serviceRequestSeverityService = serviceRequestSeverityService;
    }

    // GET de todas as severidades cadastradas no sistema
    @GetMapping
    public List<ServiceRequestSeverityResponse> findAll() {
        return serviceRequestSeverityService.findAll();
    }

    // POST de uma nova severidade
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestSeverityResponse> create(@Valid @RequestBody ServiceRequestSeverityRequest request) {
        ServiceRequestSeverityResponse saved = serviceRequestSeverityService.create(request);

        URI location = URI.create("/api/service-request-severities/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar uma severidade
    @PutMapping("/{id}")
    public ResponseEntity<ServiceRequestSeverityResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestSeverityRequest request) {
        ServiceRequestSeverityResponse updated = serviceRequestSeverityService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar uma severidade (soft delete)
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ServiceRequestSeverityResponse> deactivate(@PathVariable Integer id) {
        ServiceRequestSeverityResponse deactivated = serviceRequestSeverityService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar uma severidade
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ServiceRequestSeverityResponse> reactivate(@PathVariable Integer id) {
        ServiceRequestSeverityResponse reactivated = serviceRequestSeverityService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
