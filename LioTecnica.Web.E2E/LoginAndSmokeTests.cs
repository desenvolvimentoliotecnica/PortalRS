using Microsoft.Playwright;
using Xunit;

namespace LioTecnica.Web.E2E;

[CollectionDefinition("e2e")]
public sealed class E2ECollection : ICollectionFixture<PlaywrightFixture> { }

[Collection("e2e")]
public sealed class LoginAndSmokeTests
{
    private readonly PlaywrightFixture _fx;

    public LoginAndSmokeTests(PlaywrightFixture fx)
    {
        _fx = fx;
    }

    [Fact]
    public async Task LoginPage_OwnerButton_SetsTenantToOwner()
    {
        await using var ctx = await _fx.NewContextAsync();
        var page = await ctx.NewPageAsync();

        var response = await page.GotoAsync("/Account/Login", new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });
        AssertNotNullResponse(response, _fx.Settings.BaseUrl, "/Account/Login");
        Assert.Equal(200, response!.Status);

        await page.Locator("#ownerLoginBtn").ClickAsync();
        await ExpectAsync(page.Locator("#tenantIdInput")).ToHaveValueAsync("owner");
    }

    [Fact]
    public async Task TenantLogin_Smoke_NavigatesCorePages()
    {
        await using var ctx = await _fx.NewContextAsync();
        var page = await ctx.NewPageAsync();

        var consoleErrors = new List<string>();
        if (_fx.Settings.FailOnConsoleError)
        {
            page.Console += (_, msg) =>
            {
                if (msg.Type == "error")
                    consoleErrors.Add(msg.Text);
            };
            page.PageError += (_, ex) => consoleErrors.Add(ex);
        }

        // 1) Login
        var loginResp = await page.GotoAsync("/Account/Login", new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });
        AssertNotNullResponse(loginResp, _fx.Settings.BaseUrl, "/Account/Login");
        Assert.Equal(200, loginResp!.Status);

        await page.Locator("#tenantIdInput").FillAsync(_fx.Settings.TenantId);
        await page.Locator("input[name='Email']").FillAsync(_fx.Settings.Email);
        await page.Locator("input[name='Password']").FillAsync(_fx.Settings.Password);

        await page.Locator("#loginSubmit").ClickAsync();
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

        Assert.DoesNotContain("/Account/Login", page.Url, StringComparison.OrdinalIgnoreCase);

        // 2) Smoke: páginas principais
        var routes = new[]
        {
            "/Dashboard",
            "/Vagas",
            "/Candidatos",
            "/Talentos",
            "/Matching",
            "/Feedback"
        };

        foreach (var route in routes)
        {
            var resp = await page.GotoAsync(route, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });
            AssertNotNullResponse(resp, _fx.Settings.BaseUrl, route);
            Assert.Equal(200, resp!.Status);
            Assert.DoesNotContain("/Account/Login", page.Url, StringComparison.OrdinalIgnoreCase);
        }

        if (_fx.Settings.FailOnConsoleError && consoleErrors.Count > 0)
            throw new Xunit.Sdk.XunitException("Console/Page errors:\n- " + string.Join("\n- ", consoleErrors.Distinct()));
    }

    private static void AssertNotNullResponse(IResponse? response, Uri baseUrl, string route)
    {
        if (response is null)
        {
            throw new Xunit.Sdk.XunitException(
                $"Sem resposta ao navegar para '{route}'. " +
                $"Verifique se o `LioTecnica.Web` está rodando em '{baseUrl}'.");
        }
    }

    private static ILocatorAssertions ExpectAsync(ILocator locator) => Assertions.Expect(locator);
}

