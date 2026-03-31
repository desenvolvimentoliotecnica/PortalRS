using System.Threading.Channels;

namespace RhPortal.Api.Application.Matching;

public sealed record MatchingRecomputeRequest(
    Guid VagaId,
    string TenantId,
    string FiltersHash,
    int Take,
    string RuleVersion);

public sealed class MatchingRecomputeQueue
{
    private readonly Channel<MatchingRecomputeRequest> _channel;

    public MatchingRecomputeQueue()
    {
        _channel = Channel.CreateBounded<MatchingRecomputeRequest>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
    }

    public ChannelWriter<MatchingRecomputeRequest> Writer => _channel.Writer;
    public ChannelReader<MatchingRecomputeRequest> Reader => _channel.Reader;
}
