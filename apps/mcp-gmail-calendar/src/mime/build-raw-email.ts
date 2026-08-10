interface EmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachment?: Attachment
}

interface Attachment {
  filename: string;
  mimeType: string;
  base64Data: string;
}

/** Base64url encoding (RFC 4648 §5) - Gmail's API rejects standard base64 padding/chars. */
function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** MIME "encoded word" so non-ASCII subjects render correctly in mail clients. */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/**
 * Builds the `raw` payload for gmail.users.messages.send - a plain-text email
 * with UTF-8 support. Kept intentionally simple (no attachments/HTML) since
 * that covers what this assistant needs to send on the user's behalf; a
 * proper MIME multipart builder is straightforward to add here later without
 * touching any of the calling code.
 */
export function buildRawEmail(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachment?: Attachment; // NEW
}): string {
  const boundary = `boundary_${Date.now()}`;
  const headers = [
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : null,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  let message: string;

  if (params.attachment) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message = [
      headers.join("\r\n"),
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      params.body,
      "",
      `--${boundary}`,
      `Content-Type: ${params.attachment.mimeType}; name="${params.attachment.filename}"`,
      `Content-Disposition: attachment; filename="${params.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      params.attachment.base64Data,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    message = `${headers.join("\r\n")}\r\n\r\n${params.body}`;
  }

  return Buffer.from(message).toString("base64url");
}