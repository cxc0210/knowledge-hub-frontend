import { httpService } from "@/services/http";

export const AI_ACTION_STATUS = {
  pending: 0,
  executing: 10,
  succeeded: 20,
  failed: 30,
  rejected: 40,
  expired: 50,
} as const;

export type EmailAction = {
  id: string;
  action_type: "email_send";
  status: number;
  recipients: string[];
  subject: string;
  body: string;
  provider_message_id: string | null;
  error_message: string | null;
  expires_at: string;
  approved_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function approveEmailAction(actionId: string) {
  return httpService.post<EmailAction>(`/ai/actions/${actionId}/approve`);
}

export function rejectEmailAction(actionId: string) {
  return httpService.post<EmailAction>(`/ai/actions/${actionId}/reject`);
}
