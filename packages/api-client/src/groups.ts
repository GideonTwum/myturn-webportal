import type { ApiClient } from "./client";
import type {
  MemberGroupDetail,
  MemberGroupMembersResponse,
  MemberGroupsResponse,
} from "./types";

export function createGroupsApi(client: ApiClient) {
  return {
    list() {
      return client.get<MemberGroupsResponse>("/member/groups", true);
    },
    get(groupId: string) {
      return client.get<MemberGroupDetail>(`/member/groups/${groupId}`, true);
    },
    listMembers(groupId: string) {
      return client.get<MemberGroupMembersResponse>(
        `/member/groups/${groupId}/members`,
        true,
      );
    },
    invitePreview(inviteCode: string) {
      return client.get<Record<string, unknown>>(
        `/groups/invite/${encodeURIComponent(inviteCode)}`,
        false,
      );
    },
    join(body: {
      inviteCode: string;
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
    }) {
      return client.post<AuthSessionLike>("/groups/join", body, false);
    },
  };
}

type AuthSessionLike = {
  access_token?: string;
  accessToken?: string;
  user: unknown;
  message?: string;
};
