import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const WEBHOOK_EVENTS = ['quote.created', 'quote.status_changed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Pushes events to external platforms (CRM, WhatsApp gateway, ERP...).
 * Each request is signed: X-Alaman-Signature = sha256 HMAC of the raw body with the webhook secret.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  dispatch(event: WebhookEvent, data: unknown) {
    void this.deliverAll(event, data).catch((e) => this.logger.error(e));
  }

  private async deliverAll(event: WebhookEvent, data: unknown) {
    const hooks = await this.prisma.webhook.findMany({ where: { isActive: true, events: { has: event } } });
    const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data });
    await Promise.all(
      hooks.map(async (hook) => {
        let status = 0;
        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Alaman-Event': event,
              'X-Alaman-Signature': createHmac('sha256', hook.secret).update(body).digest('hex'),
            },
            body,
            signal: AbortSignal.timeout(10_000),
          });
          status = res.status;
        } catch (e) {
          this.logger.warn(`Webhook ${hook.url} failed: ${(e as Error).message}`);
        }
        await this.prisma.webhook.update({ where: { id: hook.id }, data: { lastStatus: status, lastDeliveredAt: new Date() } });
      }),
    );
  }
}
