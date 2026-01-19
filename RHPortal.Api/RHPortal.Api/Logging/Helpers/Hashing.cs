using System.Security.Cryptography;
using System.Text;

namespace RhPortal.Api.Logging.Helpers;

public static class Hashing
{
    public static string Sha256Hex(string input)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
        return Convert.ToHexString(bytes);
    }
}
