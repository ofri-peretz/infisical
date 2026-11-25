import { EventType } from "../event-type";

// Lands in the summary event's metadata when a collapse window closes. Add it to the metadata
// type of any event you pass to createCollapsedAuditLog.
export type TAuditLogCollapseSummary = {
  suppressedRepeats?: number;
  suppressedFrom?: string;
  suppressedUntil?: string;
};

export interface CreateAlertEvent {
  type: EventType.CREATE_ALERT;
  metadata: {
    alertId: string;
    name: string;
    resourceType: string;
    resourceId?: string | null;
    resourceName?: string | null;
    eventType: string;
  };
}

export interface UpdateAlertEvent {
  type: EventType.UPDATE_ALERT;
  metadata: {
    alertId: string;
    name: string;
    resourceType: string;
    resourceId?: string | null;
    resourceName?: string | null;
    eventType: string;
  };
}

export interface DeleteAlertEvent {
  type: EventType.DELETE_ALERT;
  metadata: {
    alertId: string;
    name: string;
    resourceType: string;
    resourceId?: string | null;
    resourceName?: string | null;
    eventType: string;
  };
}

export interface TestAlertChannelEvent {
  type: EventType.TEST_ALERT_CHANNEL;
  metadata: {
    channelId?: string;
    channelType: string;
    resourceType: string;
    resourceId?: string | null;
    resourceName?: string | null;
    success: boolean;
    deliveredTo?: number;
    error?: string;
  };
}

export type TMiscAuditLogEvent = CreateAlertEvent | UpdateAlertEvent | DeleteAlertEvent | TestAlertChannelEvent;
