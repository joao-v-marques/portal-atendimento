package com.joao_v_marques.portal_atendimento.service_requests.category;

import com.joao_v_marques.portal_atendimento.service_requests.category.dto.ServiceRequestCategoryRequest;
import com.joao_v_marques.portal_atendimento.service_requests.category.dto.ServiceRequestCategoryResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-request-categories")
public class ServiceRequestCategoryController {

    private final ServiceRequestCategoryService serviceRequestCategoryService;

    public ServiceRequestCategoryController(ServiceRequestCategoryService serviceRequestCategoryService) {
        this.serviceRequestCategoryService = serviceRequestCategoryService;
    }

    // GET de todas as categorias de atendimento cadastradas no sistema
    @GetMapping
    public List<ServiceRequestCategoryResponse> findAll() {
        return serviceRequestCategoryService.findAll();
    }

    // POST de uma nova categoria de atendimento
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestCategoryResponse> create(@Valid @RequestBody ServiceRequestCategoryRequest request) {
        ServiceRequestCategoryResponse saved = serviceRequestCategoryService.create(request);

        URI location = URI.create("/api/service-request-categories/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar uma categoria de atendimento
    @PutMapping("/{id}")
    public ResponseEntity<ServiceRequestCategoryResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestCategoryRequest request) {
        ServiceRequestCategoryResponse updated = serviceRequestCategoryService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar uma categoria de atendimento (soft delete)
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ServiceRequestCategoryResponse> deactivate(@PathVariable Integer id) {
        ServiceRequestCategoryResponse deactivated = serviceRequestCategoryService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar uma categoria de atendimento
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ServiceRequestCategoryResponse> reactivate(@PathVariable Integer id) {
        ServiceRequestCategoryResponse reactivated = serviceRequestCategoryService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
