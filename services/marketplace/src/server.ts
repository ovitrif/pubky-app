import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  isAllowedMarketplaceOrigin,
  MARKETPLACE_CSRF_HEADER,
  MARKETPLACE_CSRF_TOKEN,
  marketplaceSecurityHeaders,
} from '../../../src/libs/commerce/marketplace-http-security';
import { isSandboxFinance, isSandboxModerator, isSandboxRisk } from '../../../src/libs/commerce/sandbox-roles';
import { commerceAggregateIdSchema, commercePubkySchema } from '../../../src/libs/commerce/transaction-contracts';
import { PostgresMarketplaceRepository } from './postgres-repository';
import {
  InMemoryMarketplaceRepository,
  MARKETPLACE_SANDBOX_MODERATOR,
  MarketplaceTransactionService,
} from './transaction-service';

export type MarketplaceServerMode = 'disabled' | 'sandbox';
export type MarketplaceStorageMode = 'memory' | 'postgres';

export interface MarketplaceServerOptions {
  mode: MarketplaceServerMode;
  service?: MarketplaceTransactionService;
  maxBodyBytes?: number;
  allowedOrigin?: string;
  storage?: MarketplaceStorageMode;
}

export function createMarketplaceHttpServer({
  mode,
  service = new MarketplaceTransactionService(new InMemoryMarketplaceRepository()),
  maxBodyBytes = 1_000_000,
  allowedOrigin = '*',
  storage = 'memory',
}: MarketplaceServerOptions): Server {
  return createServer(async (request, response) => {
    try {
      if (mode === 'sandbox') {
        response.setHeader('access-control-allow-origin', allowedOrigin);
        response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
        response.setHeader(
          'access-control-allow-headers',
          `content-type, x-pubky-actor, x-recipient-pubky, ${MARKETPLACE_CSRF_HEADER}`,
        );
      }
      if (request.method === 'OPTIONS') {
        writeHead(response, 204, mode);
        response.end();
        return;
      }

      if (mode === 'sandbox' && request.method === 'POST') {
        const mutationError = mutationGuard(request, allowedOrigin);
        if (mutationError) {
          writeJson(response, 403, { error: { code: 'UNAUTHORIZED', message: mutationError } }, mode);
          return;
        }
      }

      if (request.method === 'GET' && request.url === '/health/live') {
        writeJson(response, 200, { status: 'live' }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/health/ready') {
        const ready = mode === 'sandbox';
        writeJson(
          response,
          ready ? 200 : 503,
          {
            status: ready ? 'ready' : 'not_ready',
            mode,
            storage,
          },
          mode,
        );
        return;
      }

      if (request.method === 'POST' && request.url === '/v1/commands') {
        if (mode !== 'sandbox') {
          writeJson(
            response,
            503,
            { error: { code: 'UNAVAILABLE', message: 'Marketplace commands are disabled.' } },
            mode,
          );
          return;
        }

        const actor = request.headers['x-pubky-actor'];
        if (Array.isArray(actor) || actor === undefined) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'A sandbox actor header is required.' } },
            mode,
          );
          return;
        }
        const contentType = headerValue(request.headers['content-type']);
        if (!contentType.toLocaleLowerCase('en-US').startsWith('application/json')) {
          writeJson(
            response,
            415,
            { error: { code: 'INVALID_COMMAND', message: 'Marketplace commands must be application/json.' } },
            mode,
          );
          return;
        }

        const body = await readJsonBody(request, maxBodyBytes);
        const result = await service.execute(actor, body);
        const status = result.ok ? 200 : statusForFailure(result.error.code);
        writeJson(response, status, result, mode);
        return;
      }

      if (request.method === 'POST' && request.url === '/v1/attachments') {
        if (mode !== 'sandbox') {
          writeJson(
            response,
            503,
            { error: { code: 'UNAVAILABLE', message: 'Marketplace attachments are disabled.' } },
            mode,
          );
          return;
        }
        const actor = request.headers['x-pubky-actor'];
        const recipient = request.headers['x-recipient-pubky'];
        const mimeType = request.headers['content-type']?.split(';')[0] ?? '';
        if (Array.isArray(actor) || Array.isArray(recipient) || !actor || !recipient) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Attachment participants are required.' } },
            mode,
          );
          return;
        }
        const bytes = await readBytesBody(request, 5 * 1024 * 1024);
        const result = service.storeAttachment(actor, recipient, mimeType, bytes);
        writeJson(
          response,
          result.ok ? 201 : result.code === 'UNAUTHORIZED' ? 401 : 400,
          result.ok ? result.attachment : { error: { code: result.code, message: result.message } },
          mode,
        );
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/attachments/')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        const attachmentId = request.url.slice('/v1/attachments/'.length);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Attachment actor is required.' } }, mode);
          return;
        }
        const attachment = service.getAttachment(actorResult.data, attachmentId);
        if (!attachment) {
          writeJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Attachment not found.' } }, mode);
          return;
        }
        response.writeHead(
          200,
          marketplaceSecurityHeaders(mode, {
            'content-type': attachment.mimeType,
            'content-length': String(attachment.byteSize),
            'cache-control': 'private, no-store',
            'x-content-hash': attachment.contentHash,
          }),
        );
        response.end(attachment.bytes);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/listings?')) {
        const aggregateId = new URL(request.url, 'http://marketplace.local').searchParams.get('aggregateId');
        const parsed = commerceAggregateIdSchema.safeParse(aggregateId);
        if (!parsed.success) {
          writeJson(
            response,
            400,
            { error: { code: 'INVALID_COMMAND', message: 'A valid listing aggregate id is required.' } },
            mode,
          );
          return;
        }
        const listing = service.getListingProjection(parsed.data);
        writeJson(
          response,
          listing ? 200 : 404,
          listing ?? { error: { code: 'NOT_FOUND', message: 'Listing not found.' } },
          mode,
        );
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/offers')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        const aggregateId = new URL(request.url, 'http://marketplace.local').searchParams.get('aggregateId');
        const aggregateResult = aggregateId === null ? null : commerceAggregateIdSchema.safeParse(aggregateId);
        if (!actorResult.success || (aggregateResult !== null && !aggregateResult.success)) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Valid offer participant identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(
          response,
          200,
          {
            offers:
              aggregateResult?.success === true
                ? service.getParticipantOffers(actorResult.data, aggregateResult.data)
                : service.getOffers(actorResult.data),
          },
          mode,
        );
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/conversations') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Valid conversation participant identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(response, 200, { conversations: service.getParticipantConversations(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/notifications') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Valid notification recipient identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(response, 200, { notifications: service.getNotifications(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/notification-preferences') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Valid notification owner identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(response, 200, service.getNotificationPreferences(actorResult.data), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/orders') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Order actor is required.' } }, mode);
          return;
        }
        writeJson(response, 200, { orders: service.getOrders(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/payments/')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        const paymentId = request.url.slice('/v1/payments/'.length);
        const payment = actorResult.success ? service.getPayment(actorResult.data, paymentId) : null;
        writeJson(
          response,
          payment ? 200 : actorResult.success ? 404 : 401,
          payment ?? {
            error: { code: actorResult.success ? 'NOT_FOUND' : 'UNAUTHORIZED', message: 'Payment unavailable.' },
          },
          mode,
        );
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/receipts/')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        const receiptId = request.url.slice('/v1/receipts/'.length);
        const receipt = actorResult.success ? service.getReceipt(actorResult.data, receiptId) : null;
        writeJson(
          response,
          receipt ? 200 : actorResult.success ? 404 : 401,
          receipt ?? {
            error: { code: actorResult.success ? 'NOT_FOUND' : 'UNAUTHORIZED', message: 'Receipt unavailable.' },
          },
          mode,
        );
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/restricted-listings') {
        writeJson(response, 200, { listingIds: service.getRestrictedListingIds() }, mode);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/ledger')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Ledger actor is required.' } }, mode);
          return;
        }
        const orderId = new URL(request.url, 'http://marketplace.local').searchParams.get('orderId') ?? undefined;
        writeJson(response, 200, { entries: service.getLedger(actorResult.data, orderId) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/promotions') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Promotion actor is required.' } }, mode);
          return;
        }
        writeJson(response, 200, { promotions: service.getPromotions(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/analytics') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Analytics actor is required.' } }, mode);
          return;
        }
        writeJson(response, 200, service.getSellerAnalytics(actorResult.data), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/statements') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Statement actor is required.' } }, mode);
          return;
        }
        writeJson(response, 200, service.getSellerStatement(actorResult.data), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/risk-signals') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Risk actor is required.' } }, mode);
          return;
        }
        writeJson(response, 200, { signals: service.getRiskSignals(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/blocked-buyers') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Seller identity is required.' } }, mode);
          return;
        }
        writeJson(response, 200, { buyerPubkys: service.getBlockedBuyers(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/reputation')) {
        const seller = new URL(request.url, 'http://marketplace.local').searchParams.get('seller');
        const sellerResult = commercePubkySchema.safeParse(seller);
        if (!sellerResult.success) {
          writeJson(response, 400, { error: { code: 'INVALID_COMMAND', message: 'Seller pubky is required.' } }, mode);
          return;
        }
        writeJson(response, 200, service.getSellerReputation(sellerResult.data), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/metrics') {
        writeJson(response, 200, service.getMetrics(), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/invariants') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success || (!isSandboxModerator(actorResult.data) && !isSandboxFinance(actorResult.data))) {
          writeJson(
            response,
            403,
            { error: { code: 'UNAUTHORIZED', message: 'Finance or operator identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(response, 200, service.getInvariants(), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/enforcements') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Risk identity is required.' } }, mode);
          return;
        }
        if (!isSandboxRisk(actorResult.data) && !isSandboxModerator(actorResult.data)) {
          writeJson(response, 403, { error: { code: 'UNAUTHORIZED', message: 'Risk role required.' } }, mode);
          return;
        }
        writeJson(response, 200, { enforcements: service.getEnforcements(actorResult.data) }, mode);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/v1/admin/search')) {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        const query = new URL(request.url, 'http://marketplace.local').searchParams.get('q') ?? '';
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Admin identity is required.' } }, mode);
          return;
        }
        writeJson(response, 200, service.searchAdmin(actorResult.data, query), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/admin/snapshot') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success || actorResult.data !== MARKETPLACE_SANDBOX_MODERATOR) {
          writeJson(
            response,
            403,
            { error: { code: 'UNAUTHORIZED', message: 'Operator identity is required.' } },
            mode,
          );
          return;
        }
        writeJson(response, 200, service.exportRepositorySnapshot(), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/account/export') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Account identity is required.' } }, mode);
          return;
        }
        writeJson(response, 200, service.exportAccount(actorResult.data), mode);
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/reports') {
        const actor = request.headers['x-pubky-actor'];
        const actorResult = commercePubkySchema.safeParse(Array.isArray(actor) ? null : actor);
        if (!actorResult.success) {
          writeJson(
            response,
            401,
            { error: { code: 'UNAUTHORIZED', message: 'Moderator identity is required.' } },
            mode,
          );
          return;
        }
        if (actorResult.data !== MARKETPLACE_SANDBOX_MODERATOR) {
          writeJson(response, 403, { error: { code: 'UNAUTHORIZED', message: 'Moderator role required.' } }, mode);
          return;
        }
        writeJson(response, 200, { reports: service.getReports(actorResult.data) }, mode);
        return;
      }

      writeJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found.' } }, mode);
    } catch (error) {
      const code = error instanceof RequestBodyError ? error.code : 'INTERNAL_ERROR';
      const status = error instanceof RequestBodyError ? error.status : 500;
      const message = error instanceof RequestBodyError ? error.message : 'Marketplace request failed.';
      if (!(error instanceof RequestBodyError)) {
        console.error('[marketplace] request failed', error);
      }
      writeJson(response, status, { error: { code, message } }, mode);
    }
  });
}

class RequestBodyError extends Error {
  constructor(
    readonly code: 'INVALID_JSON' | 'BODY_TOO_LARGE',
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const bytes = await readBytesBody(request, maxBodyBytes);
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new RequestBodyError('INVALID_JSON', 400, 'Request body must be valid JSON.');
  }
}

async function readBytesBody(request: IncomingMessage, maxBodyBytes: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) {
      throw new RequestBodyError('BODY_TOO_LARGE', 413, 'Request body is too large.');
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function writeHead(response: ServerResponse, status: number, mode: MarketplaceServerMode): void {
  const headers = marketplaceSecurityHeaders(mode);
  response.writeHead(status, headers);
}

function writeJson(response: ServerResponse, status: number, body: object, mode: MarketplaceServerMode): void {
  response.writeHead(
    status,
    marketplaceSecurityHeaders(mode, {
      'content-type': 'application/json; charset=utf-8',
    }),
  );
  response.end(JSON.stringify(body));
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function mutationGuard(request: IncomingMessage, allowedOrigin: string): string | null {
  const csrf = headerValue(request.headers[MARKETPLACE_CSRF_HEADER]);
  if (csrf !== MARKETPLACE_CSRF_TOKEN) {
    return 'A marketplace CSRF header is required.';
  }
  if (
    !isAllowedMarketplaceOrigin(
      headerValue(request.headers.origin) || undefined,
      headerValue(request.headers.referer) || undefined,
      allowedOrigin,
    )
  ) {
    return 'The request origin is not allowed.';
  }
  return null;
}

function statusForFailure(code: string): number {
  switch (code) {
    case 'INVALID_COMMAND':
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'REVISION_CONFLICT':
    case 'IDEMPOTENCY_CONFLICT':
    case 'INSUFFICIENT_INVENTORY':
    case 'INVARIANT_VIOLATION':
    case 'INVALID_STATE':
    case 'BID_TOO_LOW':
      return 409;
    case 'OFFER_EXPIRED':
    case 'AUCTION_CLOSED':
      return 410;
    default:
      return 500;
  }
}

async function main(): Promise<void> {
  const mode: MarketplaceServerMode = process.env.MARKETPLACE_MODE === 'sandbox' ? 'sandbox' : 'disabled';
  const port = Number.parseInt(process.env.MARKETPLACE_PORT ?? '3100', 10);
  const host = process.env.MARKETPLACE_HOST ?? '127.0.0.1';
  const databaseUrl = process.env.DATABASE_URL;
  const repository = databaseUrl
    ? await PostgresMarketplaceRepository.connect(databaseUrl)
    : new InMemoryMarketplaceRepository();
  const service = new MarketplaceTransactionService(repository);
  const server = createMarketplaceHttpServer({
    mode,
    service,
    storage: databaseUrl ? 'postgres' : 'memory',
    allowedOrigin: process.env.MARKETPLACE_ALLOWED_ORIGIN ?? '*',
  });
  server.listen(port, host, () => {
    console.info(`[marketplace] listening on ${host}:${port} (${mode}, ${databaseUrl ? 'postgres' : 'memory'})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
