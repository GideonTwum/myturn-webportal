import { type ViewStyle } from "react-native";
import { ShimmerBar } from "./motion";

type Props = { width?: number | `${number}%`; height?: number; style?: ViewStyle };

export function ShimmerLoader(props: Props) {
  return <ShimmerBar {...props} />;
}
