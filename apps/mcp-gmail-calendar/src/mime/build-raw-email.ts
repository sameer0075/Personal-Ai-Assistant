interface EmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
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
export function buildRawEmail({ to, subject, body, cc }: EmailInput): string {
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ].filter((line): line is string => line !== null);

  const message = [...headers, "", body].join("\r\n");
  return toBase64Url(message);
}