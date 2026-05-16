import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Service {
  id: number;
  slug: string;
  name: string;
  name_hi: string;
  description: string;
  price: string;
  is_free: boolean;
  features: string[];
  color: string;
  icon: string;
}

interface Coupon {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_amount: number;
}

interface CouponValidation {
  valid: boolean;
  coupon: Coupon;
  discount_amount: number;
  final_amount: number;
}

interface CartContextType {
  selectedServices: Service[];
  appliedCoupon: CouponValidation | null;
  paymentMethod: string;
  
  // Cart actions
  addToCart: (service: Service) => void;
  removeFromCart: (serviceId: number) => void;
  isInCart: (serviceId: number) => boolean;
  clearCart: () => void;
  
  // Coupon actions
  applyCoupon: (coupon: CouponValidation) => void;
  removeCoupon: () => void;
  
  // Payment
  setPaymentMethod: (method: string) => void;
  
  // Calculations
  subtotal: number;
  discount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [paymentMethod, setPaymentMethodState] = useState('cash');

  const addToCart = (service: Service) => {
    setSelectedServices(prev => {
      if (prev.find(s => s.id === service.id)) {
        return prev; // Already in cart
      }
      return [...prev, service];
    });
    
    // Clear coupon when cart changes
    if (appliedCoupon) {
      setAppliedCoupon(null);
    }
  };

  const removeFromCart = (serviceId: number) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
    
    // Clear coupon when cart changes
    if (appliedCoupon) {
      setAppliedCoupon(null);
    }
  };

  const isInCart = (serviceId: number): boolean => {
    return selectedServices.some(s => s.id === serviceId);
  };

  const clearCart = () => {
    setSelectedServices([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (coupon: CouponValidation) => {
    setAppliedCoupon(coupon);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Calculate totals
  const subtotal = selectedServices.reduce((sum, service) => {
    return sum + parseFloat(service.price);
  }, 0);

  const discount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const total = Math.max(0, subtotal - discount);

  const value: CartContextType = {
    selectedServices,
    appliedCoupon,
    paymentMethod,
    addToCart,
    removeFromCart,
    isInCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    setPaymentMethod: setPaymentMethodState,
    subtotal,
    discount,
    total,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
