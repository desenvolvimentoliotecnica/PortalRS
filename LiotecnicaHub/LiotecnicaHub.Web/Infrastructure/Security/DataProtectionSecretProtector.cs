using Microsoft.AspNetCore.DataProtection;

namespace LiotecnicaHub.Web.Infrastructure.Security;

public interface ISecretProtector
{
    string Protect(string plainText);
    string Unprotect(string protectedText);
}

public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("LiotecnicaHub.EntraSecrets.v1");
    }

    public string Protect(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return string.Empty;
        return _protector.Protect(plainText);
    }

    public string Unprotect(string protectedText)
    {
        if (string.IsNullOrEmpty(protectedText)) return string.Empty;
        try
        {
            return _protector.Unprotect(protectedText);
        }
        catch (System.Security.Cryptography.CryptographicException ex)
        {
            throw new InvalidOperationException(
                "Não foi possível ler o client secret salvo. " +
                "Salve novamente o secret no Admin ou restaure o volume de chaves DataProtection.",
                ex);
        }
    }
}
