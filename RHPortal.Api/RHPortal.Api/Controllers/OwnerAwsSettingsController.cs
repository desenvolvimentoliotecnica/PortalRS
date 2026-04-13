using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.AwsSettings;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configuração global de armazenamento AWS S3 (Owner — compartilhada por todos os tenants).
/// </summary>
[ApiController]
[Route("api/owner/aws-settings")]
[Authorize(Policy = "Owner")]
public sealed class OwnerAwsSettingsController : ControllerBase
{
    private readonly IAwsSettingsService _service;

    public OwnerAwsSettingsController(IAwsSettingsService service)
    {
        _service = service;
    }

    /// <summary>
    /// Obtém a configuração AWS S3 global (credenciais mascaradas).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AwsSettingsView), StatusCodes.Status200OK)]
    public async Task<ActionResult<AwsSettingsView>> Get(CancellationToken ct)
        => Ok(await _service.GetViewAsync(ct));

    /// <summary>
    /// Salva a configuração AWS S3 global.
    /// Campos em branco mantêm o valor anterior.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(AwsSettingsView), StatusCodes.Status200OK)]
    public async Task<ActionResult<AwsSettingsView>> Save([FromBody] AwsSettingsDto dto, CancellationToken ct)
        => Ok(await _service.SaveAsync(dto, ct));

    /// <summary>
    /// Testa a conexão com o bucket S3 configurado.
    /// </summary>
    [HttpPost("testar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Testar(CancellationToken ct)
    {
        var opts = await _service.GetDecryptedAsync(ct);
        if (opts is null)
            return BadRequest(new { message = "AWS S3 não configurado." });

        try
        {
            var credentials = new BasicAWSCredentials(opts.AccessKeyId, opts.SecretAccessKey);
            var region = RegionEndpoint.GetBySystemName(opts.Region);
            using var s3 = new AmazonS3Client(credentials, region);

            await s3.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = opts.BucketName,
                MaxKeys = 1,
            }, ct);

            return Ok(new { message = $"Conexão com bucket '{opts.BucketName}' bem-sucedida." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Falha na conexão: {ex.Message}" });
        }
    }
}
