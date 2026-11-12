/** A tiny file that starts with the PDF signature, which is all the upload check looks at. */
export function samplePdf(label: string) {
  return {
    name: `${label}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n`),
  };
}
