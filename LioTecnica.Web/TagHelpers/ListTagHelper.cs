using Microsoft.AspNetCore.Razor.TagHelpers;

namespace LioTecnica.Web.TagHelpers;

[HtmlTargetElement("lt-list")]
public sealed class ListTagHelper : TagHelper
{
    [HtmlAttributeName("tag")]
    public string Tag { get; set; } = "div";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = string.IsNullOrWhiteSpace(Tag) ? "div" : Tag;
        output.Attributes.RemoveAll("tag");
    }
}
