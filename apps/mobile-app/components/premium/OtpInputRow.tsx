import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
};

export function OtpInputRow({ value, onChange }: Props) {
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(LENGTH, " ").split("").slice(0, LENGTH);

  function updateAt(index: number, char: string) {
    const next = [...digits];
    next[index] = char.slice(-1);
    onChange(next.join("").replace(/\s/g, ""));
    if (char && index < LENGTH - 1) refs.current[index + 1]?.focus();
  }

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          style={styles.cell}
          keyboardType="number-pad"
          maxLength={1}
          value={d.trim()}
          onChangeText={(t) => updateAt(i, t)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace" && !d.trim() && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceContainerLow,
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    color: tokens.colors.onSurface,
  },
});
