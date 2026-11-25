import { validate as isUuid } from "uuid";

import type { TActorContext, TActorContextBase } from "@app/domains/lib/actor-context";
import { EntityNotFoundError, PermissionDeniedError, RuleViolationError } from "@app/domains/lib/errors";
import { platformPrincipal, TPrincipal } from "@app/lib/auth/principal";

import { FOREIGN_SSO_SESSION_ERROR_NAME, TSsoSessionRefusal } from "../../models/sso-policy";
import { TOrganizationStore } from "../dependencies";
import { TSsoSessionService } from "../sso-session/service";

export type TRequestActorContext<TContext extends TActorContextBase = TActorContext> = {
  actor: TContext;
  // Set when the org's sign-in policy refuses the session: the request is turned away as signed out.
  ssoRefusal: TSsoSessionRefusal | null;
};

// What every caller gets is a full TActorContext: the top level (server/lib/actor-context-builder.ts) wraps this
// domain's service, which builds the principal and org, and adds the audit configuration. This domain's own
// ActorContextService is TActorContextService<TActorContextBase>.
export type TActorContextService<TContext extends TActorContextBase = TActorContext> = {
  // The context the auth middleware puts on a request. A session not yet scoped to an existing org (before one is
  // selected, or a deprecated API key) gets a context whose org refuses when used.
  forRequest(input: { principal: TPrincipal; orgId: string | undefined }): Promise<TRequestActorContext<TContext>>;
  // The context for a user or identity acting in one org outside a request. Refuses an org that does not exist.
  forPrincipal(input: { principal: TPrincipal; orgId: string }): Promise<TContext>;
  // forPrincipal for a user session checked away from its own request (a stream refresh, a callback, a queued job, a
  // check made for another member with the requester's sign-in method). Refuses when the org's sign-in policy no
  // longer allows the session.
  forSession(input: { principal: TPrincipal; orgId: string }): Promise<TContext>;
  // The context for work the platform does in an org on nobody's behalf: queues, crons, consumers.
  system(input: { orgId: string }): Promise<TContext>;
};

const notScopedToAnOrg = () =>
  new RuleViolationError({
    message: "This request is not scoped to an organization. Select an organization and try again."
  });

export class ActorContextService implements TActorContextService<TActorContextBase> {
  constructor(
    private readonly organizationStore: TOrganizationStore,
    private readonly ssoSessionService: TSsoSessionService
  ) {}

  async forRequest({ principal, orgId }: { principal: TPrincipal; orgId: string | undefined }) {
    const org = orgId && isUuid(orgId) ? await this.organizationStore.findActorOrg(orgId) : null;
    if (!org) return { actor: ActorContextService.unscoped(principal), ssoRefusal: null };
    const ssoRefusal = await this.ssoSessionService.findSsoSessionRefusal({ principal, org });
    return { actor: { principal, org }, ssoRefusal };
  }

  async forPrincipal({ principal, orgId }: { principal: TPrincipal; orgId: string }): Promise<TActorContextBase> {
    const org = await this.organizationStore.findActorOrg(orgId);
    if (!org) throw new EntityNotFoundError({ message: `Organization with ID '${orgId}' not found` });
    return { principal, org };
  }

  async forSession({ principal, orgId }: { principal: TPrincipal; orgId: string }): Promise<TActorContextBase> {
    const actor = await this.forPrincipal({ principal, orgId });
    const refusal = await this.ssoSessionService.findSsoSessionRefusal(actor);
    if (refusal) {
      throw new PermissionDeniedError({
        message: refusal.message,
        ...(refusal.name === FOREIGN_SSO_SESSION_ERROR_NAME ? { name: FOREIGN_SSO_SESSION_ERROR_NAME } : {})
      });
    }
    return actor;
  }

  system({ orgId }: { orgId: string }): Promise<TActorContextBase> {
    return this.forPrincipal({ principal: platformPrincipal(), orgId });
  }

  // org is non-enumerable and throws on read, so spreading req.permission never trips it.
  private static unscoped(principal: TPrincipal): TActorContextBase {
    return Object.defineProperty({ principal }, "org", {
      enumerable: false,
      get: () => {
        throw notScopedToAnOrg();
      }
    }) as TActorContextBase;
  }
}
