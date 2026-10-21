package com.joao_v_marques.portal_atendimento.service_requests.type;

import com.joao_v_marques.portal_atendimento.service_requests.type.dto.ServiceRequestTypeRequest;
import com.joao_v_marques.portal_atendimento.service_requests.type.dto.ServiceRequestTypeResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-request-types")
public class ServiceRequestTypeController {

    private final ServiceRequestTypeService serviceRequestTypeService;

    public ServiceRequestTypeController(ServiceRequestTypeService serviceRequestTypeService) {
        this.serviceRequestTypeService = serviceRequestTypeService;
    }

    // GET de todos os tipos de atendimento cadastrados no sistema
    @GetMapping
    public List<ServiceRequestTypeResponse> findAll() {
        return serviceRequestTypeService.findAll();
    }

    // POST de um novo tipo de atendimento
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestTypeResponse> create(@Valid @RequestBody ServiceRequestTypeRequest request) {
        ServiceRequestTypeResponse saved = serviceRequestTypeService.create(request);

        URI location = URI.create("/api/service-request-types/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar um tipo de atendimento
    @PutMapping("/{id}")
    public ResponseEntity<ServiceRequestTypeResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestTypeRequest request) {
        ServiceRequestTypeResponse updated = serviceRequestTypeService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar um tipo de atendimento (soft delete)
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ServiceRequestTypeResponse> deactivate(@PathVariable Integer id) {
        ServiceRequestTypeResponse deactivated = serviceRequestTypeService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar um tipo de atendimento
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ServiceRequestTypeResponse> reactivate(@PathVariable Integer id) {
        ServiceRequestTypeResponse reactivated = serviceRequestTypeService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
