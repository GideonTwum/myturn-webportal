import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyGroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(main)/groups/${id ?? "g1"}`} />;
}
