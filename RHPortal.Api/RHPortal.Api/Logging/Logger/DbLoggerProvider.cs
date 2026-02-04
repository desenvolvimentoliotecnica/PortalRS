using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Logging.Context;

namespace RhPortal.Api.Logging.Logger;

public sealed class DbLoggerProvider : ILoggerProvider
{
    private readonly ILogContextAccessor _accessor;
    private readonly ChannelWriter<LogEntryEnvelope> _writer;

    public DbLoggerProvider(
        ILogContextAccessor accessor,
        Channel<LogEntryEnvelope> channel)
    {
        _accessor = accessor;
        _writer = channel.Writer;
    }

    public ILogger CreateLogger(string categoryName)
        => new DbLogger(categoryName, _accessor, _writer);

    public void Dispose()
    {
    }
}
