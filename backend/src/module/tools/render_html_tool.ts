import DOMPurify from "isomorphic-dompurify";
import type { ToolDefinition } from "../ai_agent/types";
import type { ToolHandler } from "./tool_registry";

const ALLOWED_TAGS = [
  "html", "head", "body", "style",
  "div", "span", "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "a", "img", "figure", "figcaption",
  "strong", "em", "b", "i", "u", "s", "code", "pre", "blockquote",
  "svg", "circle", "ellipse", "line", "path", "polygon", "polyline", "rect",
  "text", "tspan", "g", "defs", "clipPath", "mask", "marker",
  "linearGradient", "radialGradient", "stop",
  "foreignObject",
  "details", "summary",
];

const ALLOWED_ATTR = [
  "id", "class", "style",
  "href", "target", "rel", "src", "alt", "width", "height",
  "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "transform", "viewBox", "xmlns",
  "font-family", "font-size", "text-anchor", "dominant-baseline",
  "opacity", "clip-path", "clip-rule", "fill-rule",
  "points", "marker-end", "marker-start",
  "offset", "stop-color", "stop-opacity",
  "colspan", "rowspan", "align",
  "open",
];

function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

const renderHtmlDefinition: ToolDefinition = {
  name: "render_html",
  description: "Render an HTML + CSS visualization (diagram, chart, architecture overview, rich layout) in the chat. Use this tool whenever you want to show the user a visual representation of data, structure, or relationships. The HTML is rendered in a sandboxed iframe on the frontend.",
  inputSchema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "The HTML content to render. Must be valid HTML. Include inline styles or use the css parameter for styling. SVG elements are fully supported for diagrams and charts.",
      },
      css: {
        type: "string",
        description: "Optional CSS to inject into the visualization. This will be included in a <style> block in the document head. Use for consistent styling across elements.",
      },
      title: {
        type: "string",
        description: "Optional title for the visualization. Displayed as a caption above the rendered output.",
      },
    },
    required: ["html"],
  },
};

const MAX_HTML_LENGTH = 100_000;

export const renderHtmlHandler: ToolHandler = {
  definition: renderHtmlDefinition,
  async execute(input) {
    const html = input.html as string | undefined;
    const css = input.css as string | undefined;
    const title = input.title as string | undefined;

    if (!html || typeof html !== "string") {
      return { output: "Missing required parameter: html", isError: true };
    }

    if (html.length > MAX_HTML_LENGTH) {
      return { output: `HTML content exceeds maximum length of ${MAX_HTML_LENGTH} characters.`, isError: true };
    }

    const sanitizedHtml = sanitizeHtml(html);
    const sanitizedCss = css ? sanitizeHtml(`<style>${css}</style>`).replace(/<\/?style>/g, "") : undefined;

    return {
      output: `Visualization rendered successfully${title ? `: "${title}"` : ""}.`,
      visualization: {
        html: sanitizedHtml,
        title,
        css: sanitizedCss,
      },
    };
  },
};
