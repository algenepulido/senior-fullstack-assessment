import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api";
import { theme } from "../theme";

type Sku = { id: number; title: string; price: number; thumbnail: string; quantity: number };

type Props = { onLogout: () => void };

export default function ItemsScreen({ onLogout }: Props) {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSkus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Sku[]>("/skus");
      setSkus(data);
    } catch (e: any) {
      setError(e.message || "Failed to load items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSkus(); }, [fetchSkus]);

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      }
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/selections", {
        method: "POST",
        body: JSON.stringify({ sku_ids: Array.from(selected) }),
      });
      setSelected(new Set());
      await fetchSkus();
    } catch (e: any) {
      setError(e.message || "Failed to confirm selection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Items</Text>
        <Pressable onPress={onLogout} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Select up to 2 items</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ flex: 1 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : skus.length === 0 ? (
        <Text style={styles.empty}>No items available.</Text>
      ) : (
        <FlatList
          data={skus}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleSelect(item.id)}
              >
                <Image source={{ uri: item.thumbnail }} style={styles.image} resizeMode="cover" />
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                <Text style={styles.cardQty}>Qty: {item.quantity}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {!loading && (
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {submitting ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Pressable
              style={[styles.confirmBtn, selected.size === 0 && styles.confirmBtnDisabled]}
              onPress={confirm}
              disabled={selected.size === 0}
            >
              <Text style={styles.confirmText}>
                Confirm{selected.size > 0 ? ` (${selected.size})` : ""}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  signOut: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  hint: {
    color: theme.colors.muted,
    fontSize: 13,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.backgroundDeep,
    borderRadius: theme.radius,
    width: "48%",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: theme.colors.accent,
  },
  image: {
    width: "100%",
    height: 120,
    backgroundColor: "#1a2d50",
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
    padding: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  cardPrice: {
    color: theme.colors.accent,
    fontSize: 13,
    paddingHorizontal: theme.spacing.sm,
  },
  cardQty: {
    color: theme.colors.muted,
    fontSize: 11,
    padding: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  empty: {
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 60,
  },
  error: {
    color: "#e06060",
    fontSize: 13,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#1e3060",
  },
  confirmBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.sm + theme.spacing.xs,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    color: theme.colors.backgroundDeep,
    fontWeight: "700",
    fontSize: 16,
  },
});
