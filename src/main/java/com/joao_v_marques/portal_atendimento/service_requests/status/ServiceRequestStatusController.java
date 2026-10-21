package com.joao_v_marques.portal_atendimento.service_requests.status;

import com.joao_v_marques.portal_atendimento.service_requests.status.dto.ServiceRequestStatusRequest;
import com.joao_v_marques.portal_atendimento.service_requests.status.dto.ServiceRequestStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-request-status")
public class ServiceRequestStatusController {

    private final ServiceRequestStatusService serviceRequestStatusService;

    public ServiceRequestStatusController(ServiceRequestStatusService serviceRequestStatusService) {
        this.serviceRequestStatusService = serviceRequestStatusService;
    }

    // GET de todos os status de atendimento cadastrados no sistema
    @GetMapping
    public List<ServiceRequestStatusResponse> findAll() {
        return serviceRequestStatusService.findAll();
    }

    // POST de um novo status de atendimento
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestStatusResponse> create(@Valid @RequestBody ServiceRequestStatusRequest request) {
        ServiceRequestStatusResponse saved = serviceRequestStatusService.create(request);

        URI location = URI.create("/api/service-request-status/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar um status de atendimento
    @PutMapping("/{id}")
    public ResponseEntity<ServiceRequestStatusResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestStatusRequest request) {
        ServiceRequestStatusResponse updated = serviceRequestStatusService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar um status de atendimento (soft delete)
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ServiceRequestStatusResponse> deactivate(@PathVariable Integer id) {
        ServiceRequestStatusResponse deactivated = serviceRequestStatusService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar um status de atendimento
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ServiceRequestStatusResponse> reactivate(@PathVariable Integer id) {
        ServiceRequestStatusResponse reactivated = serviceRequestStatusService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
