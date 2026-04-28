using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Talentos;

public interface ITalentoService
{
    Task<TalentoPagedResponse> ListAsync(TalentoListQuery query, CancellationToken ct);
    Task<TalentoResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CreateTalentoResult> CreateAsync(TalentoCreateRequest request, CancellationToken ct);
    Task<TalentoResponse?> UpdateAsync(Guid id, TalentoUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    /// <summary>Remove todos os talentos do tenant atual. Retorna o número removido.</summary>
    Task<int> DeleteAllForTenantAsync(CancellationToken ct);
    /// <summary>Gets or creates Talento for the given email (creates Pessoa + Talento if needed).</summary>
    Task<(Talento Talento, bool Created)> GetOrCreateByEmailAsync(string email, string? nome, string? fone, string? cidade, string? uf, string? linkedinUrl, string? resumoProfissional, string? obs, OrigemTalento origem, CancellationToken ct);
    /// <summary>Importa PDF de currículo: salva em TalentoDocumento, opcionalmente extrai dados via GPT. Se talentoId for null, cria Pessoa + Talento mínimos.</summary>
    Task<TalentoImportPdfResponse> ImportPdfAsync(Guid? talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct);
    /// <summary>Inicia importação de PDF em background: cria Talento + Documento + Job (Pendente) e retorna imediatamente.</summary>
    Task<TalentoStartImportPdfResponse> StartImportPdfAsync(Guid? talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct);
    /// <summary>Processa um job de importação de CV (chamado pelo worker).</summary>
    Task ProcessImportJobAsync(Guid jobId, CancellationToken ct);
    /// <summary>Aprova a aplicação dos dados do CV no cadastro similar (job em PendenteValidacao).</summary>
    Task AprovarCvImportJobAsync(Guid jobId, CancellationToken ct);
    /// <summary>Recusa a aplicação no similar; mantém o talento atual como está.</summary>
    Task RecusarCvImportJobAsync(Guid jobId, CancellationToken ct);
    /// <summary>Retorna o detalhe do job em PendenteValidacao (CV extraído + talento existente similar) para comparação na UI.</summary>
    Task<CvImportJobValidationResponse?> GetCvImportJobAsync(Guid jobId, CancellationToken ct);
    /// <summary>Retorna o arquivo de um documento do talento para download.</summary>
    Task<TalentoDocumentoFileResult?> GetDocumentoFileAsync(Guid talentoId, Guid documentoId, CancellationToken ct);
    /// <summary>Upload de currículo (PDF) no talento existente: salva documento, extrai texto e dados sugeridos pela LLM para revisar na tela e aplicar.</summary>
    Task<TalentoCurriculoExtrairResponse?> UploadCurriculoEExtrairAsync(Guid talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct);
}

public sealed record TalentoDocumentoFileResult(string FilePath, string? ContentType, string FileName);
