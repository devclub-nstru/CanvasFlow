/**
 * Emits a JSON-LD block.
 *
 * The payload is serialised with JSON.stringify and the closing-tag sequence
 * escaped, so a string inside the graph can never break out of the script
 * element. Structured data is inert content — it is read by crawlers, never
 * executed by the page.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
