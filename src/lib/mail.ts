/// Sending email.
///
/// Configured by two variables and absent without them, so the app runs
/// perfectly well with no mail provider — which is how it has run until now,
/// and how a local checkout still runs.
///
/// Nothing here throws. An invitation that fails because a mail provider is
/// having a bad afternoon is still an invitation: the collaborator row is what
/// grants access, and the email only tells them about it. Losing the second
/// must not lose the first.
import { Resend } from "resend";

export const mailConfigured = Boolean(
  process.env.RESEND_API_KEY && process.env.MAIL_FROM,
);

export type SendResult =
  | { sent: true }
  | { sent: false; reason: string };

export async function sendMail(options: {
  to: string;
  subject: string;
  /// Both parts are given: some clients, and some people, prefer plain text,
  /// and a mail with only HTML is likelier to be treated as spam.
  text: string;
  html: string;
}): Promise<SendResult> {
  if (!mailConfigured) {
    return { sent: false, reason: "Email is not configured on this deployment" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Send failed" };
  }
}

/// Escapes text going into the HTML part.
///
/// A trip title is written by a person and can contain anything; dropping it
/// into markup unescaped is how a stray angle bracket breaks the layout, and
/// how something worse gets into somebody's inbox.
function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/// The invitation itself.
///
/// Deliberately plain. It says who invited you, to what, and gives one link —
/// the things a person needs in order to decide whether they care.
export function invitationEmail(options: {
  inviterName: string;
  tripTitle: string;
  url: string;
}) {
  const { inviterName, tripTitle, url } = options;
  const subject = `${inviterName} invited you to "${tripTitle}" on Roava`;

  const text = [
    `${inviterName} has invited you to help plan "${tripTitle}".`,
    "",
    "You can add places, days and journeys, and see theirs.",
    "",
    url,
    "",
    "If you don't have a Roava account, opening the link will set one up.",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#14212B;max-width:520px">
      <p style="font-size:16px">
        <strong>${escape(inviterName)}</strong> has invited you to help plan
        <strong>${escape(tripTitle)}</strong>.
      </p>
      <p style="color:#55677A">
        You can add places, days and journeys, and see theirs.
      </p>
      <p style="margin:28px 0">
        <a href="${escape(url)}"
           style="background:#14B8A6;color:#14212B;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">
          Open the trip
        </a>
      </p>
      <p style="color:#55677A;font-size:13px">
        If you don't have a Roava account, opening the link will set one up.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}
