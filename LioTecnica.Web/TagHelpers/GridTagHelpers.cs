using System.Text;
using Microsoft.AspNetCore.Razor.TagHelpers;

namespace LioTecnica.Web.TagHelpers;

[HtmlTargetElement("lt-grid")]
public sealed class GridTagHelper : TagHelper
{
    internal static readonly object HeaderKey = new();
    internal static readonly object BodyKey = new();

    [HtmlAttributeName("table-class")]
    public string? TableClass { get; set; }

    [HtmlAttributeName("table-id")]
    public string? TableId { get; set; }

    [HtmlAttributeName("wrapper-class")]
    public string? WrapperClass { get; set; } = "table-responsive";

    [HtmlAttributeName("body-id")]
    public string? BodyId { get; set; }

    [HtmlAttributeName("body-class")]
    public string? BodyClass { get; set; }

    public override async Task ProcessAsync(TagHelperContext context, TagHelperOutput output)
    {
        await output.GetChildContentAsync();

        var header = context.Items.TryGetValue(HeaderKey, out var headerObj)
            ? headerObj as string
            : null;

        var body = context.Items.TryGetValue(BodyKey, out var bodyObj)
            ? bodyObj as string
            : null;

        output.TagName = "div";
        output.Attributes.SetAttribute("class", WrapperClass ?? string.Empty);

        var sb = new StringBuilder();
        sb.Append("<table");
        if (!string.IsNullOrWhiteSpace(TableClass))
            sb.Append(" class=\"").Append(TableClass).Append('"');
        if (!string.IsNullOrWhiteSpace(TableId))
            sb.Append(" id=\"").Append(TableId).Append('"');
        sb.Append('>');

        if (!string.IsNullOrWhiteSpace(header))
            sb.Append("<thead>").Append(header).Append("</thead>");

        sb.Append("<tbody");
        if (!string.IsNullOrWhiteSpace(BodyId))
            sb.Append(" id=\"").Append(BodyId).Append('"');
        if (!string.IsNullOrWhiteSpace(BodyClass))
            sb.Append(" class=\"").Append(BodyClass).Append('"');
        sb.Append('>');
        if (!string.IsNullOrWhiteSpace(body))
            sb.Append(body);
        sb.Append("</tbody>");

        sb.Append("</table>");

        output.Content.SetHtmlContent(sb.ToString());
    }
}

[HtmlTargetElement("lt-grid-header", ParentTag = "lt-grid")]
public sealed class GridHeaderTagHelper : TagHelper
{
    public override async Task ProcessAsync(TagHelperContext context, TagHelperOutput output)
    {
        var content = await output.GetChildContentAsync();
        context.Items[GridTagHelper.HeaderKey] = content.GetContent();
        output.SuppressOutput();
    }
}

[HtmlTargetElement("lt-grid-body", ParentTag = "lt-grid")]
public sealed class GridBodyTagHelper : TagHelper
{
    public override async Task ProcessAsync(TagHelperContext context, TagHelperOutput output)
    {
        var content = await output.GetChildContentAsync();
        context.Items[GridTagHelper.BodyKey] = content.GetContent();
        output.SuppressOutput();
    }
}
