import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Development driver: writes the message to the log instead of sending it, so
 * password-reset links are visible locally without an email provider.
 */
export function createConsoleMailer(): Mailer {
  return {
    async send(message) {
      logger.info(
        {
          to: message.to,
          subject: message.subject,
          body: message.text,
        },
        "mail.sent (console driver — message was not delivered)",
      );
    },
  };
}

/**
 * Resend driver. Selected when RESEND_API_KEY is configured.
 *
 * Called lazily so the module can be imported without the dependency present.
 */
function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Mail delivery failed with ${response.status}: ${detail.slice(0, 500)}`,
        );
      }
    },
  };
}

function resolveMailer(): Mailer {
  if (env.RESEND_API_KEY) {
    return createResendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  }

  if (env.NODE_ENV === "production") {
    // Silently dropping password-reset emails in production would be worse than
    // refusing to boot.
    throw new Error(
      "RESEND_API_KEY must be configured in production to send email",
    );
  }

  return createConsoleMailer();
}

let cached: Mailer | undefined;

export function getMailer(): Mailer {
  cached ??= resolveMailer();
  return cached;
}
