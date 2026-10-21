package com.joao_v_marques.portal_atendimento.service_requests.channel;

import com.joao_v_marques.portal_atendimento.service_requests.channel.dto.ServiceRequestChannelRequest;
import com.joao_v_marques.portal_atendimento.service_requests.channel.dto.ServiceRequestChannelResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/service-request-channels")
public class ServiceRequestChannelController {

    private final ServiceRequestChannelService serviceRequestChannelService;

    public ServiceRequestChannelController(ServiceRequestChannelService serviceRequestChannelService) {
        this.serviceRequestChannelService = serviceRequestChannelService;
    }

    // GET de todos os canais de atendimento cadastrados no sistema
    @GetMapping
    public List<ServiceRequestChannelResponse> findAll() {
        return serviceRequestChannelService.findAll();
    }

    // POST de um novo canal de atendimento
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ServiceRequestChannelResponse> create(@Valid @RequestBody ServiceRequestChannelRequest request) {
        ServiceRequestChannelResponse saved = serviceRequestChannelService.create(request);

        URI location = URI.create("/api/service-request-channels/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar um canal de atendimento
    @PutMapping("/{id}")
    public ResponseEntity<ServiceRequestChannelResponse> update(@PathVariable Integer id, @Valid @RequestBody ServiceRequestChannelRequest request) {
        ServiceRequestChannelResponse updated = serviceRequestChannelService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar um canal de atendimento (soft delete)
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ServiceRequestChannelResponse> deactivate(@PathVariable Integer id) {
        ServiceRequestChannelResponse deactivated = serviceRequestChannelService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar um canal de atendimento
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ServiceRequestChannelResponse> reactivate(@PathVariable Integer id) {
        ServiceRequestChannelResponse reactivated = serviceRequestChannelService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
