import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../theme';

interface Service {
  id: number;
  name: string;
  price: string;
}

interface CartSidebarProps {
  services: Service[];
  subtotal: number;
  discount: number;
  total: number;
  onRemove: (serviceId: number) => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  services,
  subtotal,
  discount,
  total,
  onRemove,
}) => {
  if (services.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Shopping Cart</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Select services to add to cart</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Cart</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{services.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.items} showsVerticalScrollIndicator={false}>
        {services.map((service) => (
          <View key={service.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{service.name}</Text>
              <Text style={styles.itemPrice}>₹{service.price}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(service.id)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal:</Text>
          <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
        </View>

        {discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.discountLabel]}>Discount:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -₹{discount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...theme.typography.caption,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  items: {
    maxHeight: 200,
    marginBottom: theme.spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  itemPrice: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  removeButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '700',
  },
  summary: {
    marginTop: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
  },
  summaryValue: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
  },
  discountLabel: {
    color: theme.colors.success,
  },
  discountValue: {
    color: theme.colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.sm,
  },
  totalLabel: {
    ...theme.typography.h4,
    color: theme.colors.text.primary,
  },
  totalValue: {
    ...theme.typography.h4,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
});
