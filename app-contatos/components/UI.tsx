import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { global } from "../styles/global";
export function Page({ children }: PropsWithChildren) {
  return (
    <KeyboardAvoidingView
      style={global.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={global.content}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View>
      <Text style={global.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#7C8799"
        style={global.input}
        {...props}
      />
    </View>
  );
}
export function Action({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        global.button,
        secondary && global.secondary,
        { opacity: pressed || disabled || busy ? 0.6 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? "#285AE8" : "#FFFFFF"} />
      ) : (
        <Text style={[global.buttonText, secondary && global.secondaryText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <Text accessibilityRole="alert" style={global.error}>
      {message}
    </Text>
  ) : null;
}
