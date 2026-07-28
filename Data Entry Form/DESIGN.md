---
name: Modern Utility Desktop
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1b1b'
  on-surface-variant: '#424752'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#005db5'
  primary: '#00488d'
  on-primary: '#ffffff'
  primary-container: '#005fb8'
  on-primary-container: '#cadcff'
  inverse-primary: '#a8c8ff'
  secondary: '#4c616c'
  on-secondary: '#ffffff'
  secondary-container: '#cfe6f2'
  on-secondary-container: '#526772'
  tertiary: '#474849'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f6060'
  on-tertiary-container: '#dbdbdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a8c8ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#00468b'
  secondary-fixed: '#cfe6f2'
  secondary-fixed-dim: '#b4cad6'
  on-secondary-fixed: '#071e27'
  on-secondary-fixed-variant: '#354a53'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fcf9f8'
  on-background: '#1b1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  input-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  button-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 12px
  form-gap: 20px
---

## Brand & Style
This design system is engineered for high-density data entry and enterprise-level utility. The aesthetic is inspired by modern Windows desktop environments, emphasizing productivity, precision, and low cognitive load. It utilizes a **Corporate Modern** style with elements of **Minimalism** to ensure that data remains the primary focus. 

The target audience consists of professional operators who require a reliable, non-distracting interface for extended periods of use. The emotional response is one of stability and efficiency—a "tool, not a toy" philosophy. The UI avoids unnecessary ornamentation, favoring structural clarity and systematic alignment.

## Colors
The palette is rooted in professional reliability. 
- **Primary:** A focused "Windows Blue" used for primary actions and active states.
- **Secondary:** Slate grays for secondary navigation, iconography, and less critical UI elements.
- **Surface:** A clean white background to maximize contrast for text and input fields.
- **Muted/Neutral:** Grays are used for borders, disabled states, and subtle backgrounds to create a clear hierarchy between the canvas and the controls.

## Typography
**Inter** is selected for its exceptional legibility in data-heavy environments. The typographic scale is compact to accommodate complex forms. 
- **Data Labels:** Use `label-caps` for field headers to provide a distinct visual anchor that separates metadata from the user-entered data.
- **Inputs:** Use `input-text` for the actual data entry to ensure high readability.
- **Headlines:** Reserved for page titles and section headers to maintain a clear document structure.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy typical of desktop applications, where content is organized into logical functional panes. 
- **Rhythm:** A 4px baseline grid ensures tight, disciplined spacing suitable for data-dense interfaces.
- **Form Layout:** Fields are organized in 2 or 3 column spans within a standard container.
- **Adaptation:** On smaller windows, the grid collapses columns to maintain input width. Desktop views favor side-by-side master-detail views to reduce navigation clicks.

## Elevation & Depth
This design system uses **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows to convey depth.
- **Surface Level 0:** The main application background in light gray (#F3F3F3).
- **Surface Level 1:** White containers/cards used for the actual form work areas.
- **Borders:** 1px solid borders in a soft gray (#D1D1D1) define input fields and section boundaries.
- **Active State:** A subtle 2px primary color bottom-border or halo is used to indicate focus on an input field, ensuring the user always knows where the cursor is.

## Shapes
The shape language is **Soft (Level 1)**. This provides a professional, modern look that feels approachable but maintains the "square" discipline of a utility tool. 
- Standard inputs and buttons use a 4px corner radius.
- Large containers may use up to 8px for a slightly more modern "windowed" feel.
- Avoid fully rounded "pill" shapes, as they waste horizontal space in tight data grids.

## Components
- **Input Fields:** Use a white background with a 1px slate-gray border. When focused, the border color changes to Primary Blue. Inside text for entry should be high-contrast black.
- **Buttons:** 
  - **Primary (Register/Submit):** Solid Primary Blue with white text. High visual weight.
  - **Secondary:** White background with 1px border.
- **Data Grids:** Use subtle alternating row stripes (zebra striping) for readability. Headers are sticky and use the `label-caps` style.
- **Checkboxes/Radios:** Use standard Windows-style square/circle glyphs with Primary Blue fills when checked.
- **Status Chips:** Small, rectangular labels with rounded corners (4px) using muted background tints for "Pending," "Completed," or "Error."
- **Forms:** Labels are placed consistently above inputs to allow for faster vertical scanning during data entry.