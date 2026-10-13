import { prisma } from "@revorbit/database";

/** Deliveries older than this are pruned; they only guard redelivery windows. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Claims a GitHub webhook delivery.
 *
 * Returns false when the same `x-github-delivery` id has already been
 * processed. The insert is the claim: the primary key makes a concurrent
 * duplicate fail rather than both paths proceeding, which a
 * check-then-insert would not.
 */
export async function claimDelivery(input: {
  id: string;
  event: string;
  action?: string;
  repository?: string;
}): Promise<boolean> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        id: input.id,
        event: input.event,
        action: input.action,
        repository: input.repository,
      },
    });

    return true;
  } catch {
    // P2002 means this delivery id is already recorded.
    return false;
  }
}

/**
 * Releases a claim so a failed delivery can be retried.
 *
 * Without this a transient failure would permanently mark the delivery as
 * processed and GitHub's redelivery would be discarded.
 */
export async function releaseDelivery(id: string): Promise<void> {
  await prisma.webhookDelivery.delete({ where: { id } }).catch(() => undefined);
}

/** Removes delivery records past the redelivery window. */
export async function pruneDeliveries(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_MS);

  const { count } = await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return count;
}
