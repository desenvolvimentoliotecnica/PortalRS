using Microsoft.Playwright;

namespace LioTecnica.Web.E2E;

public sealed class PlaywrightFixture : IAsyncLifetime
{
    public WebE2ESettings Settings { get; } = WebE2ESettings.FromEnvironment();

    public IPlaywright Playwright { get; private set; } = null!;
    public IBrowser Browser { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Playwright = await Microsoft.Playwright.Playwright.CreateAsync();
        Browser = await Playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = Settings.Headless
        });
    }

    public async Task DisposeAsync()
    {
        if (Browser is not null)
            await Browser.CloseAsync();
        Playwright?.Dispose();
    }

    public Task<IBrowserContext> NewContextAsync()
    {
        return Browser.NewContextAsync(new BrowserNewContextOptions
        {
            BaseURL = Settings.BaseUrl.ToString().TrimEnd('/'),
            IgnoreHTTPSErrors = true
        });
    }
}

