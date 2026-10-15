import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, setToken } from "../api";
import { theme } from "../theme";

type Props = { onLoggedIn: () => void };

export default function LoginScreen({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: "login" | "register") {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ token: string }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(res.token);
      onLoggedIn();
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Gesture</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.md }} />
      ) : (
        <>
          <Pressable style={styles.btn} onPress={() => submit("login")}>
            <Text style={styles.btnText}>Log In</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => submit("register")}>
            <Text style={[styles.btnText, styles.btnTextSecondary]}>Create Account</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },
  title: {
    color: theme.colors.accent,
    fontSize: 36,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    marginBottom: theme.spacing.lg * 1.5,
  },
  input: {
    backgroundColor: theme.colors.backgroundDeep,
    color: theme.colors.text,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#1e3060",
  },
  error: {
    color: "#e06060",
    marginBottom: theme.spacing.sm,
    fontSize: 14,
  },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.sm + theme.spacing.xs,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  btnText: {
    color: theme.colors.backgroundDeep,
    fontWeight: "700",
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  btnTextSecondary: {
    color: theme.colors.accent,
  },
});
