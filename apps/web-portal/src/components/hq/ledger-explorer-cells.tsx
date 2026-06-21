import type {
  LedgerExplorerGroupSummary,
  LedgerExplorerOwnerSummary,
} from "@myturn/api-client";
import {
  friendlyAccountLabel,
  groupInviteCode,
  ownerContact,
  ownerDisplayName,
  ownerRoleLabel,
} from "@/lib/ledger-labels";

export function TechnicalId({
  id,
  show,
}: {
  id: string | null | undefined;
  show: boolean;
}) {
  if (!show || !id) return null;
  return <p className="font-mono text-[10px] text-gray-400">{id}</p>;
}

export function AccountTypeCell({ accountType }: { accountType: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">
        {friendlyAccountLabel(accountType)}
      </p>
      <p className="font-mono text-[10px] text-gray-400">{accountType}</p>
    </div>
  );
}

export function OwnerCell({
  owner,
  ownerId,
  showTechnical,
}: {
  owner?: LedgerExplorerOwnerSummary | null;
  ownerId?: string | null;
  showTechnical: boolean;
}) {
  if (!owner && !ownerId) {
    return <span className="text-gray-400">—</span>;
  }

  const name = ownerDisplayName(owner);
  const role = ownerRoleLabel(owner);
  const contact = ownerContact(owner);

  return (
    <div>
      <p className="text-sm text-gray-900">
        {name ?? contact ?? "Unknown user"}
        {role ? (
          <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            {role}
          </span>
        ) : null}
      </p>
      {contact && name ? (
        <p className="text-xs text-gray-500">{contact}</p>
      ) : null}
      <TechnicalId id={ownerId ?? owner?.id} show={showTechnical} />
    </div>
  );
}

export function GroupCell({
  group,
  groupId,
  showTechnical,
}: {
  group?: LedgerExplorerGroupSummary | null;
  groupId?: string | null;
  showTechnical: boolean;
}) {
  if (!group && !groupId) {
    return <span className="text-gray-400">—</span>;
  }

  const invite = groupInviteCode(group);

  return (
    <div>
      <p className="text-sm text-gray-900">{group?.name ?? "Unknown group"}</p>
      {invite ? (
        <p className="text-xs text-gray-500">Invite: {invite}</p>
      ) : null}
      <TechnicalId id={groupId ?? group?.id} show={showTechnical} />
    </div>
  );
}
