using System.DirectoryServices.Protocols;
using System.Net;
using System.Text;
using LiotecnicaHub.Web.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Application.Authentication;

public sealed class HubLdapAuthResult
{
    public bool Success { get; init; }
    public string? DisplayName { get; init; }
    public string? ErrorMessage { get; init; }

    public static HubLdapAuthResult Ok(string? displayName) => new()
    {
        Success = true,
        DisplayName = displayName
    };

    public static HubLdapAuthResult Fail(string message) => new()
    {
        Success = false,
        ErrorMessage = message
    };
}

public sealed class HubLdapTestResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
}

public interface IHubLdapAuthService
{
    Task<HubLdapAuthResult> ValidateCredentialsAsync(
        string email,
        string password,
        HubLdapConfigDto config,
        CancellationToken ct);

    Task<HubLdapTestResult> TestConnectionAsync(HubLdapConfigDto config, CancellationToken ct);
}

public sealed class HubLdapAuthService : IHubLdapAuthService
{
    private readonly ILogger<HubLdapAuthService> _logger;

    public HubLdapAuthService(ILogger<HubLdapAuthService> logger) => _logger = logger;

    public Task<HubLdapAuthResult> ValidateCredentialsAsync(
        string email,
        string password,
        HubLdapConfigDto config,
        CancellationToken ct)
    {
        if (!config.IsEnabled || string.IsNullOrWhiteSpace(config.Server) || string.IsNullOrWhiteSpace(config.BaseDn))
            return Task.FromResult(HubLdapAuthResult.Fail("Login LDAP não está configurado."));

        try
        {
            return Task.FromResult(config.LoginIdentityMode switch
            {
                HubLdapLoginIdentityMode.UserPrincipalName => ValidateDirectBindWithFallback(
                    email, password, config),
                HubLdapLoginIdentityMode.SamAccountName => ValidateDirectBind(
                    email, password, config, BuildSamAccountName(email, config.Domain)),
                HubLdapLoginIdentityMode.SearchAndBind => ValidateSearchAndBind(email, password, config),
                _ => HubLdapAuthResult.Fail("Modo de login LDAP inválido.")
            });
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "Falha LDAP ao autenticar {Email}. Código: {ErrorCode}", email, ex.ErrorCode);
            return Task.FromResult(HubLdapAuthResult.Fail("E-mail ou senha inválidos."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado na autenticação LDAP para {Email}", email);
            return Task.FromResult(HubLdapAuthResult.Fail(
                "Não foi possível autenticar no diretório. Verifique a configuração LDAP ou tente novamente."));
        }
    }

    public Task<HubLdapTestResult> TestConnectionAsync(HubLdapConfigDto config, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(config.Server))
            return Task.FromResult(new HubLdapTestResult { Success = false, Message = "Informe o servidor LDAP." });

        if (string.IsNullOrWhiteSpace(config.BaseDn))
            return Task.FromResult(new HubLdapTestResult { Success = false, Message = "Informe o Base DN." });

        try
        {
            using var connection = CreateConnection(config);

            if (!string.IsNullOrWhiteSpace(config.BindDn))
            {
                var bindPassword = config.BindPassword;
                if (string.IsNullOrWhiteSpace(bindPassword))
                {
                    return Task.FromResult(new HubLdapTestResult
                    {
                        Success = false,
                        Message = "Conta de serviço informada, mas a senha não está salva. Informe a senha e salve."
                    });
                }

                connection.Bind(new NetworkCredential(config.BindDn, bindPassword));
            }
            else
            {
                return Task.FromResult(new HubLdapTestResult
                {
                    Success = true,
                    Message = "Conexão TCP/SSL com o servidor LDAP estabelecida. Informe a conta de serviço para validar busca no diretório."
                });
            }

            var searchBase = config.UserSearchBase ?? config.BaseDn;
            var request = new SearchRequest(
                searchBase,
                "(objectClass=*)",
                SearchScope.Base,
                "dn");

            var response = (SearchResponse)connection.SendRequest(request);
            if (response.ResultCode != ResultCode.Success)
            {
                return Task.FromResult(new HubLdapTestResult
                {
                    Success = false,
                    Message = $"Conexão ok, mas a base '{searchBase}' retornou: {response.ResultCode}."
                });
            }

            return Task.FromResult(new HubLdapTestResult
            {
                Success = true,
                Message = "Conexão LDAP estabelecida com sucesso."
            });
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "Teste LDAP falhou. Código: {ErrorCode}", ex.ErrorCode);
            return Task.FromResult(new HubLdapTestResult
            {
                Success = false,
                Message = $"Falha LDAP: {DescribeLdapError(ex)}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado no teste LDAP");
            return Task.FromResult(new HubLdapTestResult
            {
                Success = false,
                Message = $"Erro ao conectar: {ex.Message}"
            });
        }
    }

    private HubLdapAuthResult ValidateDirectBindWithFallback(
        string email,
        string password,
        HubLdapConfigDto config)
    {
        var identities = new List<string> { email };

        if (!string.IsNullOrWhiteSpace(config.Domain))
            identities.Add(BuildSamAccountName(email, config.Domain));

        LdapException? lastInvalidCredentials = null;

        foreach (var identity in identities.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                return ValidateDirectBind(email, password, config, identity);
            }
            catch (LdapException ex) when (ex.ErrorCode == 49)
            {
                lastInvalidCredentials = ex;
                _logger.LogDebug("LDAP bind recusado para identidade {Identity}", identity);
            }
        }

        if (lastInvalidCredentials is not null)
            throw lastInvalidCredentials;

        return HubLdapAuthResult.Fail("E-mail ou senha inválidos.");
    }

    private HubLdapAuthResult ValidateDirectBind(
        string email,
        string password,
        HubLdapConfigDto config,
        string bindIdentity)
    {
        using var connection = CreateConnection(config);
        connection.Bind(new NetworkCredential(bindIdentity, password));
        return HubLdapAuthResult.Ok(ExtractDisplayNameFromEmail(email));
    }

    private HubLdapAuthResult ValidateSearchAndBind(string email, string password, HubLdapConfigDto config)
    {
        if (string.IsNullOrWhiteSpace(config.BindDn))
            return HubLdapAuthResult.Fail("Conta de serviço LDAP não configurada.");

        var servicePassword = config.BindPassword;
        if (string.IsNullOrWhiteSpace(servicePassword))
            return HubLdapAuthResult.Fail("Senha da conta de serviço LDAP não disponível. Reconfigure no Admin.");

        var searchBase = config.UserSearchBase ?? config.BaseDn!;
        var filter = string.Format(config.SearchFilterTemplate, EscapeLdapFilterValue(email));
        var displayAttribute = config.DisplayNameAttribute;

        string userDn;
        string? displayName;

        using (var searchConnection = CreateConnection(config))
        {
            searchConnection.Bind(new NetworkCredential(config.BindDn, servicePassword));

            var request = new SearchRequest(
                searchBase,
                filter,
                SearchScope.Subtree,
                "dn",
                displayAttribute);

            var response = (SearchResponse)searchConnection.SendRequest(request);
            if (response.ResultCode != ResultCode.Success)
                return HubLdapAuthResult.Fail("E-mail ou senha inválidos.");

            if (response.Entries.Count == 0)
                return HubLdapAuthResult.Fail("E-mail ou senha inválidos.");

            if (response.Entries.Count > 1)
            {
                _logger.LogWarning("Busca LDAP retornou {Count} entradas para {Email}", response.Entries.Count, email);
            }

            var entry = response.Entries[0];
            userDn = entry.DistinguishedName;
            displayName = TryReadAttribute(entry, displayAttribute) ?? ExtractDisplayNameFromEmail(email);
        }

        using var userConnection = CreateConnection(config);
        userConnection.Bind(new NetworkCredential(userDn, password));
        return HubLdapAuthResult.Ok(displayName);
    }

    private static LdapConnection CreateConnection(HubLdapConfigDto config)
    {
        var server = config.Server!.Trim();
        var identifier = new LdapDirectoryIdentifier(server, config.Port, fullyQualifiedDnsHostName: false, connectionless: false);
        var connection = new LdapConnection(identifier)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };

        connection.SessionOptions.ProtocolVersion = 3;

        if (config.UseSsl)
            connection.SessionOptions.SecureSocketLayer = true;

        if (config.SkipServerCertificateValidation)
            connection.SessionOptions.VerifyServerCertificate = (_, _) => true;

        if (config.UseStartTls)
            connection.SessionOptions.StartTransportLayerSecurity(null);

        return connection;
    }

    private static string BuildSamAccountName(string email, string? domain)
    {
        var username = email.Contains('@', StringComparison.Ordinal)
            ? email.Split('@', 2)[0]
            : email;

        return string.IsNullOrWhiteSpace(domain)
            ? username
            : $"{domain.Trim()}\\{username}";
    }

    private static string? TryReadAttribute(SearchResultEntry entry, string attributeName)
    {
        foreach (string key in entry.Attributes.AttributeNames)
        {
            if (!string.Equals(key, attributeName, StringComparison.OrdinalIgnoreCase))
                continue;

            var values = entry.Attributes[key];
            if (values is null || values.Count == 0)
                return null;

            return values[0] switch
            {
                byte[] bytes => Encoding.UTF8.GetString(bytes),
                string text => text,
                _ => values[0]?.ToString()
            };
        }

        return null;
    }

    private static string ExtractDisplayNameFromEmail(string email)
    {
        var local = email.Contains('@', StringComparison.Ordinal)
            ? email.Split('@', 2)[0]
            : email;
        return local.Replace('.', ' ');
    }

    private static string EscapeLdapFilterValue(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            switch (ch)
            {
                case '\\':
                    builder.Append("\\5c");
                    break;
                case '*':
                    builder.Append("\\2a");
                    break;
                case '(':
                    builder.Append("\\28");
                    break;
                case ')':
                    builder.Append("\\29");
                    break;
                case '\0':
                    builder.Append("\\00");
                    break;
                default:
                    builder.Append(ch);
                    break;
            }
        }

        return builder.ToString();
    }

    private static string DescribeLdapError(LdapException ex) =>
        ex.ErrorCode switch
        {
            49 => "Credenciais inválidas (código 49).",
            81 => "Servidor LDAP indisponível (código 81).",
            _ => $"{ex.Message} (código {ex.ErrorCode})."
        };
}
