import { Webhooks } from "@octokit/webhooks";

import { GITHUB_HEADERS } from "./constants.js";

export function createWebhook(secret: string) {
  const webhooks = new Webhooks({
    secret,
  });

  async function verifySignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    return webhooks.verify(payload, signature);
  }

  function getWebhookHeaders(headers: Headers | Record<string, string>) {
    const getHeader = (name: string) => {
      if (headers instanceof Headers) {
        return headers.get(name) ?? "";
      }

      return headers[name] ?? headers[name.toLowerCase()] ?? "";
    };

    return {
      event: getHeader(GITHUB_HEADERS.EVENT),
      deliveryId: getHeader(GITHUB_HEADERS.DELIVERY),
      signature: getHeader(GITHUB_HEADERS.SIGNATURE),
    };
  }

  return {
    verifySignature,
    getWebhookHeaders,
  };
}
