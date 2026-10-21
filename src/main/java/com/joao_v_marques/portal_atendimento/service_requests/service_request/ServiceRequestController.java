package com.joao_v_marques.portal_atendimento.service_requests.service_request;

import com.joao_v_marques.portal_atendimento.security.UserPrincipal;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestFinishRequest;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestRequest;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-requests")
public class ServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    public ServiceRequestController(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    // GET de todos os chamados cadastrados, do mais recente para o mais antigo
    @GetMapping
    public List<ServiceRequestResponse> findAll() {
        return serviceRequestService.findAll();
    }

    // GET de um chamado pelo ID
    @GetMapping("/{id}")
    public ServiceRequestResponse findById(@PathVariable Integer id) {
        return serviceRequestService.findById(id);
    }

    // POST para abrir um novo chamado
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestResponse> create(@Valid @RequestBody ServiceRequestRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        ServiceRequestResponse saved = serviceRequestService.create(request, currentUser.getId());

        URI location = URI.create("/api/service-requests/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar um chamado
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        ServiceRequestResponse updated = serviceRequestService.update(id, request, currentUser.getId());

        return ResponseEntity.ok(updated);
    }

    // PATCH para finalizar um chamado com a resolução
    @PatchMapping(value = "/{id}/finish", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestResponse> finish(@PathVariable Integer id, @Valid @RequestBody ServiceRequestFinishRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        ServiceRequestResponse finished = serviceRequestService.finish(id, request, currentUser.getId());

        return ResponseEntity.ok(finished);
    }

    // PATCH para reabrir um chamado finalizado
    @PatchMapping("/{id}/reopen")
    public ResponseEntity<ServiceRequestResponse> reopen(@PathVariable Integer id, @AuthenticationPrincipal UserPrincipal currentUser) {
        ServiceRequestResponse reopened = serviceRequestService.reopen(id, currentUser.getId());

        return ResponseEntity.ok(reopened);
    }
}
