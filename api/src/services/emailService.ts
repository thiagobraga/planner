import { Resend } from "resend";
import { RESEND_API_KEY, EMAIL_FROM } from "../config.js";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function buildResetBody(resetLink: string): { html: string; text: string } {
  // Plain text ships alongside the HTML: HTML-only mail scores worse with spam
  // filters and some clients render nothing at all.
  const text = [
    "Someone requested a password reset for your Planner account.",
    "",
    `Open this link to choose a new password: ${resetLink}`,
    "",
    "The link expires in one hour and can only be used once.",
    "If you didn't request this, you can ignore this email - your password stays unchanged.",
  ].join("\n");

  const html = `<div style="font-family: Georgia, 'Times New Roman', serif; color: #44443d; line-height: 1.6;">
  <p>Someone requested a password reset for your Planner account.</p>
  <p><a href="${resetLink}" style="color: #c9483b;">Choose a new password</a></p>
  <p>The link expires in one hour and can only be used once.</p>
  <p>If you didn't request this, you can ignore this email &mdash; your password stays unchanged.</p>
</div>`;

  return { html, text };
}

// Never throws. A delivery failure must not change the response of
// POST /auth/reset-password: that endpoint answers identically whether or not
// the account exists, and an error response for the "account exists but mail
// failed" case would hand an attacker exactly the enumeration signal the
// generic message is there to withhold.
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  if (!resend) {
    console.info(`[email] password reset link for ${email}: ${resetLink}`);
    return;
  }

  const { html, text } = buildResetBody(resetLink);

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your Planner password",
      html,
      text,
    });
    if (error) {
      console.error(`[email] Resend rejected password reset to ${email}: ${error.message}`);
    }
  } catch (err) {
    console.error(`[email] failed to send password reset to ${email}: ${(err as Error).message}`);
  }
}
