using System.Threading.Channels;

namespace RhPortal.Api.Logging.Logger;

public static class DbLogQueue
{
    public static Channel<LogEntryEnvelope> Create(int capacity = 5000)
        => Channel.CreateBounded<LogEntryEnvelope>(new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = false,
            SingleWriter = false
        });
}
