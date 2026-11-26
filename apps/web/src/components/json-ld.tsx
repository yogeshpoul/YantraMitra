const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g');

/** Structured data. `<` is escaped so user-entered text cannot close the script element (XSS). */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(LINE_SEPARATORS, '');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
