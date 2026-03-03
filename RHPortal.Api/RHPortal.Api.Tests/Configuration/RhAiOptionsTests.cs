using RhPortal.Api.Infrastructure.Configuration;
using Xunit;

namespace RhPortal.Api.Tests.Configuration;

public sealed class RhAiOptionsTests
{
    [Fact]
    public void ResolveRuleVersion_UsesTenantOverride_WhenExists()
    {
        var sut = new RhAiOptions
        {
            DefaultRuleVersion = "v1_80_20",
            TenantRuleVersions = new Dictionary<string, string>
            {
                ["liotecnica"] = "v2_65_35_strict",
            },
        };

        var resolved = sut.ResolveRuleVersion("Liotecnica");

        Assert.Equal("v2_65_35_strict", resolved);
    }

    [Fact]
    public void ResolveRuleVersion_FallsBackToDefault_WhenTenantMissing()
    {
        var sut = new RhAiOptions
        {
            DefaultRuleVersion = "v1_80_20",
            TenantRuleVersions = new Dictionary<string, string>
            {
                ["tenant-a"] = "v2_65_35_strict",
            },
        };

        var resolved = sut.ResolveRuleVersion("tenant-b");

        Assert.Equal("v1_80_20", resolved);
    }
}
