// Seervi EMeelan – Design System
// "Digital Civic Humanism" – warm, minimal, accessible for all Indian users

export const theme = {
  colors: {
    // ── Primary: Warm Saffron-Orange ──────────────────────────────────
    primary: '#E07B39',          // Main CTA, active states, brand highlight
    primaryLight: '#FFBE9B',     // Tinted backgrounds
    primaryDark: '#9A4601',      // Hover / pressed states
    primarySoft: '#FFF1EB',      // Very light tint for subtle backgrounds

    // ── Secondary: Trustworthy Blue ───────────────────────────────────
    secondary: '#245BB8',        // Links, secondary actions, validation
    secondaryLight: '#6E9CFE',   // Blue tinted backgrounds
    secondaryDark: '#003276',    // Deep blue for pressed
    secondarySoft: '#D9E2FF',    // Very light blue tint

    // ── Surface Hierarchy ─────────────────────────────────────────────
    background: '#FFF8F6',       // Page canvas – warm off-white
    surface: '#FFFFFF',          // Cards, modals – pure white
    surfaceContainer: '#FDEAE1', // Slightly warm container bg
    surfaceContainerHigh: '#F7E4DC',
    surfaceContainerHighest: '#F1DFD6',
    surfaceDim: '#E8D6CE',       // Pressed / disabled surface

    // ── Text ──────────────────────────────────────────────────────────
    text: {
      primary: '#231A15',        // Headings, labels – charcoal
      secondary: '#554339',      // Body text, descriptions
      disabled: '#897367',       // Placeholders, muted
      inverse: '#FFFFFF',        // White text on dark/colored bg
      link: '#245BB8',           // Hyperlinks
    },

    // ── Border / Outline ──────────────────────────────────────────────
    border: '#DCC1B4',           // Default border on cards/inputs
    borderLight: '#F1DFD6',      // Subtle dividers
    borderFocus: '#245BB8',      // Input focus ring – blue

    // ── Status ────────────────────────────────────────────────────────
    success: '#2E8B57',
    successLight: '#D4EDDA',
    error: '#BA1A1A',
    errorLight: '#FFDAD6',
    warning: '#D97706',
    warningLight: '#FFF3CD',
    info: '#00677E',
    infoLight: '#B5EBFF',

    // ── Overlay ───────────────────────────────────────────────────────
    overlay: 'rgba(35, 26, 21, 0.5)',
    overlayLight: 'rgba(35, 26, 21, 0.2)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    // Named aliases for card layout
    containerMargin: 20,
    gutter: 12,
  },

  borderRadius: {
    xs: 4,
    sm: 8,    // Inputs, chips
    md: 12,   // Buttons
    lg: 16,   // Cards, modals
    xl: 24,
    round: 9999,
  },

  typography: {
    // ── Headings (Public Sans / system bold) ──────────────────────────
    h1: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 22,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    h4: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 22,
    },

    // ── Body (Noto Sans – great Devanagari rendering) ─────────────────
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 26,   // +10% for Hindi matras
    },
    bodyLarge: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 28,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 22,
    },

    // ── Labels / UI text ──────────────────────────────────────────────
    labelLg: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0.1,
    },
    label: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
      letterSpacing: 0.5,
    },
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
  },

  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#231A15',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#231A15',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#231A15',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};

// ── Named gradient presets ─────────────────────────────────────────────────
export const gradients = {
  primary: ['#E07B39', '#9A4601'] as const,
  primarySoft: ['#FFF1EB', '#FFF8F6'] as const,
  blue: ['#245BB8', '#003276'] as const,
  success: ['#2E8B57', '#1A6B40'] as const,
  warm: ['#FFF8F6', '#F1DFD6'] as const,
};

// App branding
export const appBranding = {
  name: 'RSS EMeelan',
  nameHindi: 'आर एस एस ईमीलन',
  tagline: 'Your Family. Your Community. Your Services.',
  taglineHindi: 'हमारा देश हमारा स्वाभिमान। आपकी सेवाएं।',
};

export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeSpacing = typeof theme.spacing;
