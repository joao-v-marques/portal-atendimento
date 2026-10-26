package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.PageResponse;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.SatisfactionSurveyDashboard;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;

@RestController
@RequestMapping("/api/satisfaction-surveys")
public class SatisfactionSurveyController {

    private final SatisfactionSurveyService service;

    public SatisfactionSurveyController(SatisfactionSurveyService service) {
        this.service = service;
    }

    // GET paginado. Filtros opcionais: ?inicio=2022-05-01&fim=2022-05-31&pagina=0&tamanho=50
    @GetMapping
    public PageResponse<SatisfactionSurvey> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        return service.list(start, end, page, size);
    }

    // GET com os indicadores do mês já agrupados. Sem ?month=2022-09 usa o mês mais recente do CSV
    @GetMapping("/dashboard")
    public SatisfactionSurveyDashboard dashboard(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {

        return service.dashboard(month);
    }

    // GET que baixa o CSV do período. attachment + filename* preserva acentos no nome do arquivo
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {

        byte[] content = service.export(start, end);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename("relatorio-geral-" + LocalDate.now() + ".csv", StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(content.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(content);
    }
}
