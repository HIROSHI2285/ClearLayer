---
name: Frontend Design
description: Expert guidelines and standards for creating premium, high-fidelity web interfaces with a focus on aesthetics, user experience, and modern implementation techniques.
---

# Frontend Design Skill

This skill provides a comprehensive framework for designing and implementing "WOW" quality web interfaces.

## 1. Core Design Philosophy
- **Visual Hierarchy:** Use size, color, and spacing to guide the user's eye. Primary actions must be distinct.
- **Whitespace:** Embrace negative space to reduce cognitive load and create a premium feel.
- **Typography:** Use a curated type scale. Headings should be tight and impactful; body text readable and breathable.
- **Motion:** Interfaces must not be static. Use micro-interactions, smooth transitions, and subtle animations to make the UI feel "alive".

## 2. Technical Implementation Standards

### Styling & CSS
- **Tailwind CSS:** Use as the primary styling engine.
- **CSS Variables:** Define semantic colors (e.g., `--primary`, `--bg-glass`) in generic files for easy theming.
- **Glassmorphism:** Use `backdrop-filter: blur()` combined with semi-transparent backgrounds and delicate borders (`border-white/10`) for depth.
- **Gradients:** Use mesh gradients or subtle radial gradients to break up flat backgrounds.

### Layout & Components
- **Responsive-First:** Designs must work flawlessly on mobile, tablet, and desktop.
- **Component Driven:** Build small, reusable UI atoms (buttons, badges, cards) before composing pages.
- **Shadcn UI:** Use basic primitives but **heavily customize** the styling to avoid the "default bootstrap" look.

## 3. The "WOW" Factors (Checklist)
When tasked with "Frontend Design" or making something look "Premium", verify these elements:
- [ ] **Lighting:** Are there subtle glows or shadows?
- [ ] **Texture:** Is there a subtle noise or pattern overlay?
- [ ] **Feedback:** Do buttons press down? Do cards lift on hover?
- [ ] **Loading:** Are skeleton screens or sleek spinners used instead of jarring layout shifts?
- [ ] **Transitions:** Do elements fade in or slide up upon mounting?

## 4. Code Style for Design
- Keep JSX clean by extracting complex class strings to `cn()` utilities or variants.
- Use meaningful variable names for colors (e.g., `obsidian-black` rather than just `dark-bg`).

## Usage
When asked to design a UI, consult this skill to ensure all output meets the designated quality bar.
