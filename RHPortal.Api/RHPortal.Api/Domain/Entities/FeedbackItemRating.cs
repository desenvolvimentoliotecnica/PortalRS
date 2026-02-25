using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class FeedbackItemRating
{
    public Guid Id { get; set; }

    public Guid FeedbackItemId { get; set; }
    public FeedbackItem FeedbackItem { get; set; } = default!;

    [Required, MaxLength(120)]
    public string ItemName { get; set; } = string.Empty;

    public int Stars { get; set; } // 1-5
}
