/* @ds-bundle: {"format":4,"namespace":"SingleWindowDesignSystem_3a0998","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Checkbox","sourcePath":"components/core/Checkbox.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"74472f8b3722","components/core/Badge.jsx":"2730e6533ff8","components/core/Button.jsx":"69e65922a408","components/core/Card.jsx":"077188fae979","components/core/Checkbox.jsx":"3a51bbea791b","components/core/Input.jsx":"66c1c1ea1048","components/core/Select.jsx":"8f5f68a96b80","components/core/StatusPill.jsx":"dfe41e8b8e07","components/core/Tabs.jsx":"0a858e55626d","ui_kits/_shared/primitives.js":"771ad83860db","ui_kits/investor-portal/App.jsx":"de9f18a597dc","ui_kits/investor-portal/Applications.jsx":"604cd2f0feb7","ui_kits/investor-portal/Dashboard.jsx":"2ffbdbf4dc02","ui_kits/investor-portal/EstablishCompany.jsx":"af2c9d493e91","ui_kits/investor-portal/Login.jsx":"57f728d034fa","ui_kits/investor-portal/Shell.jsx":"bb0e2276c8fa","ui_kits/investor-portal/data.js":"f6812dfad0ba","ui_kits/investor-portal/kit-icons.jsx":"3d3603bd291f","ui_kits/portal-website/ActivityDetail.jsx":"3cf331532b83","ui_kits/portal-website/Catalog.jsx":"1051a78c829e","ui_kits/portal-website/ServiceDetail.jsx":"8d75d1941f85","ui_kits/portal-website/kit-icons.jsx":"f74f05145d0f","ui_kits/portal-website/site-app.jsx":"da5e7f138579"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SingleWindowDesignSystem_3a0998 = window.SingleWindowDesignSystem_3a0998 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Avatar
 * Initials or image avatar. Circular by default; supports sizes and a
 * subtle brand-tinted fallback.
 */
function Avatar({
  name = "",
  src,
  size = 40,
  square = false,
  style,
  ...rest
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const fontSize = Math.round(size * 0.4);
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      flex: "none",
      borderRadius: square ? "var(--radius-md)" : "50%",
      background: src ? "transparent" : "var(--blue-100)",
      color: "var(--brand-strong)",
      fontFamily: "var(--font-sans)",
      fontSize,
      fontWeight: "var(--weight-semibold)",
      letterSpacing: "var(--tracking-snug)",
      overflow: "hidden",
      border: "1px solid var(--border-subtle)",
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials || "?");
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Badge
 * Small label for counts, categories and metadata. Tones map to the palette.
 */
function Badge({
  children,
  tone = "neutral",
  variant = "soft",
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      soft: ["var(--neutral-100)", "var(--neutral-700)"],
      solid: ["var(--neutral-700)", "#fff"]
    },
    brand: {
      soft: ["var(--blue-50)", "var(--brand-strong)"],
      solid: ["var(--brand)", "#fff"]
    },
    success: {
      soft: ["var(--success-bg)", "var(--success-fg)"],
      solid: ["var(--success)", "#fff"]
    },
    warning: {
      soft: ["var(--warning-bg)", "var(--warning-fg)"],
      solid: ["var(--warning)", "#fff"]
    },
    danger: {
      soft: ["var(--danger-bg)", "var(--danger-fg)"],
      solid: ["var(--danger)", "#fff"]
    },
    info: {
      soft: ["var(--info-bg)", "var(--info)"],
      solid: ["var(--info)", "#fff"]
    }
  };
  const [bg, fg] = (tones[tone] || tones.neutral)[variant] || tones.neutral.soft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      height: 22,
      padding: "0 9px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--weight-semibold)",
      lineHeight: 1,
      color: fg,
      background: bg,
      border: variant === "outline" ? `1px solid ${fg}` : "none",
      borderRadius: "var(--radius-pill)",
      letterSpacing: "var(--tracking-snug)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// One-time injected interaction styles (hover / active / focus) so the
// component is self-sufficient wherever the bundle is loaded.
if (typeof document !== "undefined" && !document.getElementById("sw-btn-styles")) {
  const el = document.createElement("style");
  el.id = "sw-btn-styles";
  el.textContent = `
    .sw-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .sw-btn:not(:disabled):active { transform: translateY(0.5px); }
    .sw-btn--primary:not(:disabled):hover { filter: brightness(1.12); }
    .sw-btn--secondary:not(:disabled):hover { background: var(--blue-100); }
    .sw-btn--accent:not(:disabled):hover { background: var(--accent-strong); }
    .sw-btn--outline:not(:disabled):hover { background: var(--blue-50); }
    .sw-btn--ghost:not(:disabled):hover { background: var(--surface-hover); }
    .sw-btn--danger:not(:disabled):hover { background: var(--red-700); }
  `;
  document.head.appendChild(el);
}

/**
 * Single Window — Button
 * Institutional, solid primary in brand blue. Variants: primary, secondary,
 * outline, ghost, danger. Sizes: sm, md, lg. Optional leading/trailing icon.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      height: 34,
      padding: "0 16px",
      font: "var(--text-sm)",
      gap: 6
    },
    md: {
      height: 44,
      padding: "0 22px",
      font: "var(--text-base)",
      gap: 8
    },
    lg: {
      height: 52,
      padding: "0 30px",
      font: "var(--text-md)",
      gap: 10
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: "var(--action-gradient)",
      color: "#fff",
      border: "1px solid var(--navy-action)"
    },
    secondary: {
      background: "var(--blue-50)",
      color: "var(--brand-strong)",
      border: "1px solid var(--blue-100)"
    },
    accent: {
      background: "var(--accent)",
      color: "var(--on-accent)",
      border: "1px solid var(--accent)"
    },
    outline: {
      background: "#fff",
      color: "var(--brand-strong)",
      border: "1.5px solid var(--brand-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--brand-strong)",
      border: "1px solid transparent"
    },
    danger: {
      background: "var(--danger)",
      color: "#fff",
      border: "1px solid var(--danger)"
    }
  };
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    className: `sw-btn sw-btn--${variant}`,
    style: {
      display: block ? "flex" : "inline-flex",
      width: block ? "100%" : undefined,
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.height,
      padding: s.padding,
      font: "inherit",
      fontFamily: "var(--font-sans)",
      fontSize: s.font,
      fontWeight: "var(--weight-semibold)",
      lineHeight: 1,
      letterSpacing: "var(--tracking-snug)",
      borderRadius: "var(--radius-pill)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)",
      whiteSpace: "nowrap",
      ...v,
      ...style
    }
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      fontSize: "1.1em"
    }
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      fontSize: "1.1em"
    }
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Card
 * Surface container with optional title/eyebrow header and accent stripe.
 */
function Card({
  children,
  title,
  eyebrow,
  action,
  accent = false,
  padding = "var(--space-5)",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      position: "relative",
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, rest), accent ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      insetInlineStart: 0,
      top: 0,
      bottom: 0,
      width: "var(--border-width-accent)",
      background: "var(--brand)"
    }
  }) : null, title || eyebrow || action ? /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: `var(--space-4) ${typeof padding === "string" ? padding : padding + "px"}`,
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-caps)",
      color: "var(--text-subtle)",
      fontWeight: "var(--weight-semibold)"
    }
  }, eyebrow) : null, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: "var(--text-lg)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-strong)"
    }
  }, title) : null), action ? /*#__PURE__*/React.createElement("div", null, action) : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Checkbox
 * Square brand-blue checkbox with label. Controlled or uncontrolled.
 */
function Checkbox({
  label,
  checked,
  defaultChecked,
  disabled = false,
  id,
  onChange,
  style,
  ...rest
}) {
  const fieldId = id || `sw-cb-${Math.random().toString(36).slice(2, 8)}`;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: "inline-flex",
      alignItems: "flex-start",
      gap: 10,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: disabled ? "var(--text-subtle)" : "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer",
      lineHeight: 1.4,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    disabled: disabled,
    onChange: onChange,
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      width: 18,
      height: 18,
      marginTop: 1,
      flex: "none",
      borderRadius: "var(--radius-xs)",
      border: "1.5px solid var(--border-strong)",
      background: "var(--surface-card)",
      display: "grid",
      placeContent: "center",
      cursor: "inherit",
      transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)"
    },
    className: "sw-checkbox"
  }, rest)), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
if (typeof document !== "undefined" && !document.getElementById("sw-checkbox-styles")) {
  const el = document.createElement("style");
  el.id = "sw-checkbox-styles";
  el.textContent = `
    .sw-checkbox:checked { background: var(--brand); border-color: var(--brand); }
    .sw-checkbox:checked::after { content: ""; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) translateY(-1px); }
    .sw-checkbox:focus-visible { outline: none; box-shadow: var(--focus-ring); }
  `;
  document.head.appendChild(el);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
if (typeof document !== "undefined" && !document.getElementById("sw-field-styles")) {
  const el = document.createElement("style");
  el.id = "sw-field-styles";
  el.textContent = `
    .sw-field { transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard); }
    .sw-field:hover:not(:disabled) { border-color: var(--border-strong); }
    .sw-field:focus { outline: none; border-color: var(--border-focus); box-shadow: var(--focus-ring); }
    .sw-field::placeholder { color: var(--text-subtle); }
    .sw-field:disabled { background: var(--surface-sunken); color: var(--text-subtle); cursor: not-allowed; }
  `;
  document.head.appendChild(el);
}

/**
 * Single Window — Input
 * Labeled text field with optional hint / error and leading icon.
 */
function Input({
  label,
  hint,
  error,
  required = false,
  iconLeft = null,
  id,
  type = "text",
  dir,
  style,
  ...rest
}) {
  const fieldId = id || `sw-input-${Math.random().toString(36).slice(2, 8)}`;
  const invalid = Boolean(error);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-medium)",
      color: "var(--text-body)"
    }
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--danger)",
      marginInlineStart: 4
    }
  }, "*") : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      insetInlineStart: 12,
      display: "inline-flex",
      color: "var(--text-subtle)",
      fontSize: "1.05em",
      pointerEvents: "none"
    }
  }, iconLeft) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: type,
    dir: dir,
    className: "sw-field",
    "aria-invalid": invalid,
    style: {
      width: "100%",
      height: 42,
      padding: iconLeft ? "0 14px 0 38px" : "0 14px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)",
      background: "var(--surface-card)",
      border: `1px solid ${invalid ? "var(--danger)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      boxSizing: "border-box"
    }
  }, rest))), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--danger-fg)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-subtle)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Select
 * Native select styled to match Input, with a chevron affordance.
 */
function Select({
  label,
  hint,
  error,
  required = false,
  id,
  children,
  style,
  ...rest
}) {
  const fieldId = id || `sw-select-${Math.random().toString(36).slice(2, 8)}`;
  const invalid = Boolean(error);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-medium)",
      color: "var(--text-body)"
    }
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--danger)",
      marginInlineStart: 4
    }
  }, "*") : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId,
    className: "sw-field",
    "aria-invalid": invalid,
    style: {
      width: "100%",
      height: 42,
      padding: "0 38px 0 14px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)",
      background: "var(--surface-card)",
      border: `1px solid ${invalid ? "var(--danger)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      appearance: "none",
      WebkitAppearance: "none",
      cursor: "pointer",
      boxSizing: "border-box"
    }
  }, rest), children), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      insetInlineEnd: 14,
      pointerEvents: "none",
      color: "var(--text-muted)",
      fontSize: 12
    }
  }, "\u25BE")), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--danger-fg)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-subtle)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — StatusPill
 * Workflow state indicator with a leading dot. Built for declaration /
 * permit lifecycles: draft, submitted, in-review, approved, rejected, hold.
 */
function StatusPill({
  status = "draft",
  label,
  style,
  ...rest
}) {
  const map = {
    draft: {
      dot: "var(--neutral-500)",
      fg: "var(--neutral-700)",
      bg: "var(--neutral-100)",
      text: "Draft"
    },
    submitted: {
      dot: "var(--info)",
      fg: "var(--info)",
      bg: "var(--info-bg)",
      text: "Submitted"
    },
    review: {
      dot: "var(--warning)",
      fg: "var(--warning-fg)",
      bg: "var(--warning-bg)",
      text: "In review"
    },
    approved: {
      dot: "var(--success)",
      fg: "var(--success-fg)",
      bg: "var(--success-bg)",
      text: "Approved"
    },
    rejected: {
      dot: "var(--danger)",
      fg: "var(--danger-fg)",
      bg: "var(--danger-bg)",
      text: "Rejected"
    },
    hold: {
      dot: "var(--amber-600)",
      fg: "var(--amber-700)",
      bg: "var(--amber-50)",
      text: "On hold"
    }
  };
  const s = map[status] || map.draft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      height: 26,
      padding: "0 12px 0 10px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--weight-semibold)",
      color: s.fg,
      background: s.bg,
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: s.dot,
      flex: "none"
    }
  }), label || s.text);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single Window — Tabs
 * Underline tab bar. Controlled via `value`/`onChange` or uncontrolled.
 * items: [{ value, label, badge? }]
 */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  style,
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    if (onChange) onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: "flex",
      gap: 4,
      borderBottom: "1px solid var(--border-subtle)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, rest), items.map(it => {
    const on = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(it.value),
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "10px 14px",
        marginBottom: -1,
        background: "none",
        border: "none",
        borderBottom: `2px solid ${on ? "var(--brand)" : "transparent"}`,
        color: on ? "var(--brand-strong)" : "var(--text-muted)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-medium)",
        cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-standard)"
      }
    }, it.label, it.badge != null ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        fontWeight: "var(--weight-semibold)",
        color: on ? "var(--brand-strong)" : "var(--text-muted)",
        background: on ? "var(--blue-50)" : "var(--neutral-100)",
        borderRadius: "var(--radius-pill)",
        padding: "1px 7px",
        lineHeight: 1.5
      }
    }, it.badge) : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/primitives.js
try { (() => {
// Fallback DS primitives for standalone preview.
// The compiled _ds_bundle.js is only injected in the Design System tab; when a
// kit HTML is served directly the bundle 404s, so we define cosmetic equivalents
// here. Each is assigned to window ONLY if the real primitive isn't already present
// (i.e. when the bundle loaded, these are skipped).
(function () {
  const R = window.React;
  const h = R.createElement;
  const need = k => typeof window[k] === "undefined";
  function Button({
    children,
    variant = "primary",
    size = "md",
    block,
    disabled,
    iconLeft,
    iconRight,
    type = "button",
    onClick,
    style,
    ...rest
  }) {
    const sizes = {
      sm: {
        height: 34,
        padding: "0 16px",
        font: "var(--text-sm)",
        gap: 6
      },
      md: {
        height: 44,
        padding: "0 22px",
        font: "var(--text-base)",
        gap: 8
      },
      lg: {
        height: 52,
        padding: "0 30px",
        font: "var(--text-md)",
        gap: 10
      }
    };
    const s = sizes[size] || sizes.md;
    const variants = {
      primary: {
        background: "var(--action-gradient)",
        color: "#fff",
        border: "1px solid var(--navy-action)"
      },
      secondary: {
        background: "var(--blue-50)",
        color: "var(--brand-strong)",
        border: "1px solid var(--blue-100)"
      },
      accent: {
        background: "var(--accent)",
        color: "var(--on-accent)",
        border: "1px solid var(--accent)"
      },
      outline: {
        background: "#fff",
        color: "var(--brand-strong)",
        border: "1.5px solid var(--brand-strong)"
      },
      ghost: {
        background: "transparent",
        color: "var(--brand-strong)",
        border: "1px solid transparent"
      },
      danger: {
        background: "var(--danger)",
        color: "#fff",
        border: "1px solid var(--danger)"
      }
    };
    return h("button", {
      type,
      disabled,
      onClick,
      className: "sw-btn sw-btn--" + variant,
      style: {
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "var(--tracking-snug)",
        borderRadius: "var(--radius-pill)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        transition: "background var(--duration-fast) var(--ease-standard)",
        ...variants[variant],
        ...style
      },
      ...rest
    }, iconLeft ? h("span", {
      style: {
        display: "inline-flex",
        fontSize: "1.1em"
      }
    }, iconLeft) : null, children, iconRight ? h("span", {
      style: {
        display: "inline-flex",
        fontSize: "1.1em"
      }
    }, iconRight) : null);
  }
  function Field({
    label,
    hint,
    error,
    required,
    children
  }) {
    return h("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--font-sans)"
      }
    }, label ? h("label", {
      style: {
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        color: "var(--text-body)"
      }
    }, label, required ? h("span", {
      style: {
        color: "var(--danger)",
        marginInlineStart: 4
      }
    }, "*") : null) : null, children, error ? h("span", {
      style: {
        fontSize: "var(--text-xs)",
        color: "var(--danger-fg)"
      }
    }, error) : hint ? h("span", {
      style: {
        fontSize: "var(--text-xs)",
        color: "var(--text-subtle)"
      }
    }, hint) : null);
  }
  function Input({
    label,
    hint,
    error,
    required,
    iconLeft,
    type = "text",
    style,
    ...rest
  }) {
    const invalid = Boolean(error);
    return h(Field, {
      label,
      hint,
      error,
      required
    }, h("div", {
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center"
      }
    }, iconLeft ? h("span", {
      style: {
        position: "absolute",
        insetInlineStart: 12,
        display: "inline-flex",
        color: "var(--text-subtle)",
        pointerEvents: "none"
      }
    }, iconLeft) : null, h("input", {
      type,
      className: "sw-field",
      style: {
        width: "100%",
        height: 42,
        padding: iconLeft ? "0 14px 0 38px" : "0 14px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
        color: "var(--text-strong)",
        background: "var(--surface-card)",
        border: "1px solid " + (invalid ? "var(--danger)" : "var(--border-default)"),
        borderRadius: "var(--radius-md)",
        boxSizing: "border-box",
        ...style
      },
      ...rest
    })));
  }
  function Select({
    label,
    hint,
    error,
    required,
    children,
    style,
    ...rest
  }) {
    const invalid = Boolean(error);
    return h(Field, {
      label,
      hint,
      error,
      required
    }, h("div", {
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center"
      }
    }, h("select", {
      className: "sw-field",
      style: {
        width: "100%",
        height: 42,
        padding: "0 38px 0 14px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
        color: "var(--text-strong)",
        background: "var(--surface-card)",
        border: "1px solid " + (invalid ? "var(--danger)" : "var(--border-default)"),
        borderRadius: "var(--radius-md)",
        appearance: "none",
        WebkitAppearance: "none",
        cursor: "pointer",
        boxSizing: "border-box",
        ...style
      },
      ...rest
    }, children), h("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        insetInlineEnd: 14,
        pointerEvents: "none",
        color: "var(--text-muted)",
        fontSize: 12
      }
    }, "▾")));
  }
  function Checkbox({
    label,
    style,
    ...rest
  }) {
    return h("label", {
      style: {
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 10,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        color: "var(--text-body)",
        cursor: "pointer",
        lineHeight: 1.4,
        ...style
      }
    }, h("input", {
      type: "checkbox",
      className: "sw-checkbox",
      style: {
        appearance: "none",
        WebkitAppearance: "none",
        width: 18,
        height: 18,
        marginTop: 1,
        flex: "none",
        borderRadius: "var(--radius-xs)",
        border: "1.5px solid var(--border-strong)",
        background: "var(--surface-card)",
        display: "grid",
        placeContent: "center",
        cursor: "pointer"
      },
      ...rest
    }), label ? h("span", null, label) : null);
  }
  function Badge({
    children,
    tone = "neutral",
    variant = "soft",
    style
  }) {
    const tones = {
      neutral: ["var(--neutral-100)", "var(--neutral-700)"],
      brand: ["var(--blue-50)", "var(--brand-strong)"],
      success: ["var(--success-bg)", "var(--success-fg)"],
      warning: ["var(--warning-bg)", "var(--warning-fg)"],
      danger: ["var(--danger-bg)", "var(--danger-fg)"],
      info: ["var(--info-bg)", "var(--info)"]
    };
    const solid = {
      neutral: ["var(--neutral-700)", "#fff"],
      brand: ["var(--brand)", "#fff"],
      success: ["var(--success)", "#fff"],
      warning: ["var(--warning)", "#fff"],
      danger: ["var(--danger)", "#fff"],
      info: ["var(--info)", "#fff"]
    };
    const [bg, fg] = (variant === "solid" ? solid : tones)[tone] || tones.neutral;
    return h("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 9px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        lineHeight: 1,
        color: fg,
        background: bg,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style
      }
    }, children);
  }
  function StatusPill({
    status = "draft",
    label,
    style
  }) {
    const map = {
      draft: ["var(--neutral-500)", "var(--neutral-700)", "var(--neutral-100)", "Draft"],
      submitted: ["var(--info)", "var(--info)", "var(--info-bg)", "Submitted"],
      review: ["var(--warning)", "var(--warning-fg)", "var(--warning-bg)", "In review"],
      approved: ["var(--success)", "var(--success-fg)", "var(--success-bg)", "Approved"],
      rejected: ["var(--danger)", "var(--danger-fg)", "var(--danger-bg)", "Rejected"],
      hold: ["var(--amber-600)", "var(--amber-700)", "var(--amber-50)", "On hold"]
    };
    const [dot, fg, bg, text] = map[status] || map.draft;
    return h("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 26,
        padding: "0 12px 0 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: fg,
        background: bg,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style
      }
    }, h("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: dot,
        flex: "none"
      }
    }), label || text);
  }
  function Card({
    children,
    title,
    eyebrow,
    action,
    accent,
    padding = "var(--space-5)",
    style,
    ...rest
  }) {
    return h("section", {
      style: {
        position: "relative",
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        ...style
      },
      ...rest
    }, accent ? h("span", {
      style: {
        position: "absolute",
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        width: "var(--border-width-accent)",
        background: "var(--brand)"
      }
    }) : null, title || eyebrow || action ? h("header", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "var(--space-4) " + (typeof padding === "string" ? padding : padding + "px"),
        borderBottom: "1px solid var(--border-subtle)"
      }
    }, h("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, eyebrow ? h("span", {
      style: {
        fontSize: "var(--text-xs)",
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-caps)",
        color: "var(--text-subtle)",
        fontWeight: 600
      }
    }, eyebrow) : null, title ? h("h3", {
      style: {
        margin: 0,
        fontSize: "var(--text-lg)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title) : null), action ? h("div", null, action) : null) : null, h("div", {
      style: {
        padding
      }
    }, children));
  }
  function Tabs({
    items = [],
    value,
    defaultValue,
    onChange,
    style
  }) {
    const [internal, setInternal] = R.useState(defaultValue != null ? defaultValue : items[0] && items[0].value);
    const active = value !== undefined ? value : internal;
    const select = v => {
      if (value === undefined) setInternal(v);
      if (onChange) onChange(v);
    };
    return h("div", {
      role: "tablist",
      style: {
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-sans)",
        ...style
      }
    }, items.map(it => {
      const on = it.value === active;
      return h("button", {
        key: it.value,
        role: "tab",
        "aria-selected": on,
        onClick: () => select(it.value),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 14px",
          marginBottom: -1,
          background: "none",
          border: "none",
          borderBottom: "2px solid " + (on ? "var(--brand)" : "transparent"),
          color: on ? "var(--brand-strong)" : "var(--text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          fontWeight: on ? 600 : 500,
          cursor: "pointer"
        }
      }, it.label, it.badge != null ? h("span", {
        style: {
          fontSize: "var(--text-2xs)",
          fontWeight: 600,
          color: on ? "var(--brand-strong)" : "var(--text-muted)",
          background: on ? "var(--blue-50)" : "var(--neutral-100)",
          borderRadius: "var(--radius-pill)",
          padding: "1px 7px",
          lineHeight: 1.5
        }
      }, it.badge) : null);
    }));
  }
  function Avatar({
    name = "",
    src,
    size = 40,
    square,
    style
  }) {
    const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    return h("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: square ? "var(--radius-md)" : "50%",
        background: src ? "transparent" : "var(--blue-100)",
        color: "var(--brand-strong)",
        fontFamily: "var(--font-sans)",
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        overflow: "hidden",
        border: "1px solid var(--border-subtle)",
        ...style
      }
    }, src ? h("img", {
      src,
      alt: name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }) : initials || "?");
  }
  const defs = {
    Button,
    Input,
    Select,
    Checkbox,
    Badge,
    StatusPill,
    Card,
    Tabs,
    Avatar
  };
  Object.keys(defs).forEach(k => {
    if (need(k)) window[k] = defs[k];
  });

  // Self-contained interaction styles (mirrors the bundle's injected styles).
  if (!document.getElementById("sw-fallback-styles")) {
    const el = document.createElement("style");
    el.id = "sw-fallback-styles";
    el.textContent = `
      .sw-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .sw-btn:not(:disabled):active { transform: translateY(0.5px); }
      .sw-btn--primary:not(:disabled):hover { filter: brightness(1.12); }
      .sw-btn--secondary:not(:disabled):hover { background: var(--blue-100); }
      .sw-btn--accent:not(:disabled):hover { background: var(--accent-strong); }
      .sw-btn--outline:not(:disabled):hover { background: var(--blue-50); }
      .sw-field:hover:not(:disabled) { border-color: var(--border-strong); }
      .sw-field:focus { outline: none; border-color: var(--border-focus); box-shadow: var(--focus-ring); }
      .sw-field::placeholder { color: var(--text-subtle); }
      .sw-checkbox:checked { background: var(--brand); border-color: var(--brand); }
      .sw-checkbox:checked::after { content: ""; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) translateY(-1px); }
      .sw-checkbox:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    `;
    document.head.appendChild(el);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/primitives.js", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/App.jsx
try { (() => {
// App — top-level state machine for the Investor Portal prototype.
function App() {
  const [authed, setAuthed] = React.useState(false);
  const [route, setRoute] = React.useState("dashboard");
  const [toast, setToast] = React.useState(null);
  const [lang, setLang] = React.useState("en");
  const rtl = lang === "ar";

  // (Re)hydrate Lucide icons after every render; keep document direction in sync.
  React.useLayoutEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      attrs: {
        "stroke-width": 1.75
      }
    });
    document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  });
  const toggleLang = () => setLang(l => l === "en" ? "ar" : "en");
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const t = (en, ar) => rtl ? ar : en;
  if (!authed) return /*#__PURE__*/React.createElement(Login, {
    lang: lang,
    onToggleLang: toggleLang,
    onLogin: () => {
      setAuthed(true);
      setRoute("dashboard");
    }
  });
  let screen;
  if (route === "establish") {
    screen = /*#__PURE__*/React.createElement(EstablishCompany, {
      lang: lang,
      onCancel: () => setRoute("applications"),
      onSubmit: () => {
        setRoute("applications");
        showToast(t("Application submitted to Commercial Registration.", "تم إرسال الطلب إلى السجل التجاري."));
      }
    });
  } else if (route === "applications") {
    screen = /*#__PURE__*/React.createElement(Applications, {
      lang: lang,
      onNewService: () => setRoute("establish"),
      onOpen: () => showToast(t("Opening application detail…", "جارٍ فتح تفاصيل الطلب…"))
    });
  } else if (route === "dashboard") {
    screen = /*#__PURE__*/React.createElement(Dashboard, {
      lang: lang,
      onNewService: () => setRoute("establish"),
      onOpenApplications: () => setRoute("applications")
    });
  } else {
    screen = /*#__PURE__*/React.createElement(Placeholder, {
      lang: lang,
      route: route,
      onBack: () => setRoute("dashboard")
    });
  }
  const shellRoute = route === "establish" ? "applications" : route;
  return /*#__PURE__*/React.createElement(Shell, {
    active: shellRoute,
    lang: lang,
    onToggleLang: toggleLang,
    onNavigate: setRoute,
    onLogout: () => setAuthed(false)
  }, screen, toast ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      insetInlineEnd: 24,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--neutral-950)",
      color: "#fff",
      padding: "14px 18px",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      maxWidth: 380,
      animation: "sw-toast-in .26s var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--green-100)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-check",
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 500
    }
  }, toast)) : null);
}
function Placeholder({
  route,
  onBack,
  lang = "en"
}) {
  const ar = lang === "ar";
  const labels = ar ? {
    entities: "منشآتي",
    activities: "الأنشطة التجارية",
    payments: "المدفوعات",
    documents: "مستنداتي",
    support: "المساعدة والدعم"
  } : {
    entities: "My entities",
    activities: "Commercial activities",
    payments: "Payments",
    documents: "Documents",
    support: "Help & support"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 32px",
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "var(--text-2xl)",
      fontWeight: 700,
      color: "var(--text-strong)",
      margin: "0 0 16px"
    }
  }, labels[route] || route), /*#__PURE__*/React.createElement(Card, {
    padding: "48px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      textAlign: "center",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: "var(--blue-50)",
      color: "var(--brand)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hammer",
    size: 26
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, ar ? "هذه الوحدة غير متاحة في العرض التجريبي" : "This module isn't part of the demo"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 380
    }
  }, ar ? "لوحة التحكم والطلبات وتأسيس الشركة تفاعلية بالكامل في هذه المجموعة." : "The Dashboard, Applications and Establish-a-company flows are fully interactive in this UI kit."), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onBack,
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: ar ? "arrow-right" : "arrow-left",
      size: 17
    })
  }, ar ? "العودة إلى لوحة التحكم" : "Back to dashboard"))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/Applications.jsx
try { (() => {
// ApplicationTable + Applications screen (investor transactions).
function serviceIcon(service) {
  if (service.startsWith("Establish")) return "building-2";
  if (service.startsWith("Industrial")) return "factory";
  if (service.startsWith("Trade name")) return "tag";
  if (service.startsWith("CR")) return "file-pen";
  return "files";
}
const SW_AR = {
  service: {
    "Establish a company": "تأسيس شركة",
    "Industrial license": "رخصة صناعية",
    "Trade name reservation": "حجز اسم تجاري",
    "CR amendment — add activity": "تعديل سجل — إضافة نشاط",
    "CR renewal": "تجديد سجل تجاري"
  },
  status: {
    draft: "مسودة",
    submitted: "مُقدّم",
    review: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    hold: "مُعلّق"
  },
  flag: {
    "Awaiting trade-name approval": "بانتظار اعتماد الاسم التجاري",
    "Municipality approval required": "تلزم موافقة البلدية",
    "Lease attestation expired": "انتهاء توثيق عقد الإيجار"
  },
  agency: {
    "Commercial Registration": "السجل التجاري",
    "Industrial Development": "التنمية الصناعية",
    "Commercial Affairs": "الشؤون التجارية",
    "—": "—"
  }
};
function ApplicationTable({
  rows,
  compact = false,
  onOpen,
  lang = "en"
}) {
  const ar = lang === "ar";
  const t = (en, arr) => ar ? arr : en;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      textAlign: ar ? "right" : "left",
      color: "var(--text-subtle)",
      fontSize: "var(--text-xs)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-wide)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 20px",
      fontWeight: 600
    }
  }, t("Reference", "المرجع")), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, t("Service / Entity", "الخدمة / المنشأة")), !compact && /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, t("Handling entity", "الجهة المختصة")), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, t("Details", "التفاصيل")), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, t("Status", "الحالة")), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 20px",
      fontWeight: 600,
      textAlign: ar ? "left" : "right"
    }
  }, t("Updated", "آخر تحديث")))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    className: "sw-trow",
    onClick: () => onOpen && onOpen(r),
    style: {
      borderTop: "1px solid var(--border-subtle)",
      cursor: onOpen ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      fontWeight: 600,
      color: "var(--text-strong)",
      direction: "ltr"
    }
  }, r.id), r.flag ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
      fontSize: "var(--text-xs)",
      color: "var(--warning-fg)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 13
  }), ar ? SW_AR.flag[r.flag] || r.flag : r.flag) : null), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: "var(--text-sm)",
      color: "var(--text-strong)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: serviceIcon(r.service),
    size: 16,
    color: "var(--brand)"
  }), ar ? SW_AR.service[r.service] || r.service : r.service), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, r.entity)), !compact && /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px",
      fontSize: "var(--text-sm)",
      color: "var(--text-body)"
    }
  }, ar ? SW_AR.agency[r.agency] || r.agency : r.agency), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px",
      fontSize: "var(--text-sm)",
      color: "var(--text-body)"
    }
  }, r.value), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px"
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: r.status,
    label: ar ? SW_AR.status[r.status] : undefined
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 20px",
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      textAlign: ar ? "left" : "right",
      whiteSpace: "nowrap"
    }
  }, r.updated))))));
}
function Applications({
  onNewService,
  onOpen,
  lang = "en"
}) {
  const {
    applications
  } = window.SWData;
  const ar = lang === "ar";
  const t = (en, arr) => ar ? arr : en;
  const [tab, setTab] = React.useState("all");
  const counts = {
    all: applications.length,
    review: applications.filter(d => d.status === "review" || d.status === "submitted").length,
    hold: applications.filter(d => d.status === "hold" || d.status === "rejected").length,
    draft: applications.filter(d => d.status === "draft").length
  };
  const rows = applications.filter(d => {
    if (tab === "all") return true;
    if (tab === "review") return d.status === "review" || d.status === "submitted";
    if (tab === "hold") return d.status === "hold" || d.status === "rejected";
    if (tab === "draft") return d.status === "draft";
    return true;
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--text-xs)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-caps)",
      color: "var(--brand)",
      fontWeight: 600
    }
  }, t("Single dashboard", "لوحة واحدة")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "4px 0 0",
      fontSize: "var(--text-2xl)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Applications", "الطلبات"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "sliders-horizontal",
      size: 17
    })
  }, t("Filters", "تصفية")), /*#__PURE__*/React.createElement(Button, {
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18
    }),
    onClick: onNewService
  }, t("Establish a company", "تأسيس شركة")))), /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 20px 0"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: "all",
      label: t("All", "الكل"),
      badge: counts.all
    }, {
      value: "review",
      label: t("In review", "قيد المراجعة"),
      badge: counts.review
    }, {
      value: "hold",
      label: t("Needs attention", "تحتاج انتباهاً"),
      badge: counts.hold
    }, {
      value: "draft",
      label: t("Drafts", "المسودات"),
      badge: counts.draft
    }]
  })), /*#__PURE__*/React.createElement(ApplicationTable, {
    rows: rows,
    onOpen: onOpen,
    lang: lang
  })));
}
Object.assign(window, {
  ApplicationTable,
  Applications
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/Applications.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/Dashboard.jsx
try { (() => {
// Dashboard — landing screen: greeting, stats, quick services, tasks, recent activity.
function StatCard({
  s,
  ar
}) {
  const tone = {
    brand: "var(--brand)",
    warning: "var(--warning)",
    success: "var(--success)",
    info: "var(--info)"
  }[s.tone];
  const bg = {
    brand: "var(--blue-50)",
    warning: "var(--warning-bg)",
    success: "var(--success-bg)",
    info: "var(--info-bg)"
  }[s.tone];
  const isCount = s.tone === "brand" || s.tone === "warning";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px",
      boxShadow: "var(--shadow-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)",
      fontWeight: 500
    }
  }, ar ? s.labelAr : s.label), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: "var(--radius-md)",
      background: bg,
      color: tone,
      display: "grid",
      placeItems: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 19
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xl)",
      fontWeight: 700,
      color: isCount ? "var(--accent-strong)" : "var(--text-strong)",
      marginTop: 10,
      letterSpacing: "var(--tracking-tight)"
    }
  }, s.value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      marginTop: 4
    }
  }, ar ? s.deltaAr : s.delta));
}
function Dashboard({
  onNewService,
  onOpenApplications,
  lang = "en"
}) {
  const {
    user,
    stats,
    services,
    tasks,
    applications
  } = window.SWData;
  const ar = lang === "ar";
  const t = (en, arr) => ar ? arr : en;
  const recent = applications.slice(0, 4);
  const taskAr = ["اعتماد الاسم التجاري المحجوز", "دفع رسوم السجل التجاري", "إعادة رفع عقد الإيجار الموثّق"];
  const dueAr = {
    "Today": "اليوم",
    "This week": "هذا الأسبوع",
    "Overdue": "متأخرة"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)"
    }
  }, new Date().toLocaleDateString(ar ? "ar-QA" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "4px 0 0",
      fontSize: "var(--text-2xl)",
      lineHeight: 1.35,
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Welcome back, " + user.name.split(" ")[0], "أهلاً بعودتك، " + user.nameAr.split(" ")[0]))), /*#__PURE__*/React.createElement(Button, {
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18
    }),
    onClick: onNewService
  }, t("Establish a company", "تأسيس شركة"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 16
    }
  }, stats.map(s => /*#__PURE__*/React.createElement(StatCard, {
    key: s.key,
    s: s,
    ar: ar
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.6fr 1fr",
      gap: 20,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: t("Start a service", "ابدأ خدمة"),
    eyebrow: t("Investor services", "خدمات المستثمر"),
    padding: "20px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12
    }
  }, services.map(sv => /*#__PURE__*/React.createElement("button", {
    key: sv.label,
    onClick: onNewService,
    className: "sw-service",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "16px",
      textAlign: ar ? "right" : "left",
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 38,
      borderRadius: "var(--radius-md)",
      background: "var(--gold-100)",
      color: "var(--accent-ink)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: sv.icon,
    size: 20
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--text-sm)",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, ar ? sv.labelAr : sv.label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, ar ? sv.descAr : sv.desc)))))), /*#__PURE__*/React.createElement(Card, {
    title: t("Action required", "إجراء مطلوب"),
    eyebrow: t("Your tasks", "مهامك"),
    padding: "0",
    accent: true
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0
    }
  }, tasks.map((tk, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: "flex",
      gap: 12,
      padding: "14px 20px",
      borderBottom: i < tasks.length - 1 ? "1px solid var(--border-subtle)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 2,
      color: {
        warning: "var(--warning)",
        info: "var(--info)",
        danger: "var(--danger)"
      }[tk.tone]
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-circle",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, ar ? taskAr[i] : tk.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      fontFamily: "var(--font-mono)",
      marginTop: 2,
      direction: "ltr"
    }
  }, tk.ref)), /*#__PURE__*/React.createElement(Badge, {
    tone: tk.tone === "danger" ? "danger" : tk.tone === "warning" ? "warning" : "info"
  }, ar ? dueAr[tk.due] || tk.due : tk.due)))))), /*#__PURE__*/React.createElement(Card, {
    title: t("Recent applications", "أحدث الطلبات"),
    eyebrow: t("Activity", "النشاط"),
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconRight: /*#__PURE__*/React.createElement(Icon, {
        name: ar ? "arrow-left" : "arrow-right",
        size: 16
      }),
      onClick: onOpenApplications
    }, t("View all", "عرض الكل")),
    padding: "0"
  }, /*#__PURE__*/React.createElement(ApplicationTable, {
    rows: recent,
    compact: true,
    lang: lang
  })));
}
Object.assign(window, {
  Dashboard,
  StatCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/EstablishCompany.jsx
try { (() => {
// EstablishCompany — guided company-incorporation form with a step rail.
function Stepper({
  steps,
  current
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, steps.map((s, i) => {
    const state = i < current ? "done" : i === current ? "active" : "todo";
    const c = state === "done" ? "var(--success)" : state === "active" ? "var(--brand)" : "var(--neutral-300)";
    return /*#__PURE__*/React.createElement("li", {
      key: s,
      style: {
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "8px 4px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        flex: "none",
        display: "grid",
        placeItems: "center",
        background: state === "todo" ? "transparent" : c,
        border: state === "todo" ? "1.5px solid var(--neutral-300)" : "none",
        color: state === "todo" ? "var(--text-subtle)" : "#fff",
        fontSize: 13,
        fontWeight: 700
      }
    }, state === "done" ? /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    }) : i + 1), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-sm)",
        fontWeight: state === "active" ? 600 : 500,
        color: state === "active" ? "var(--text-strong)" : "var(--text-muted)"
      }
    }, s));
  }));
}
function EstablishCompany({
  onCancel,
  onSubmit,
  lang = "en"
}) {
  const ar = lang === "ar";
  const t = (en, arr) => ar ? arr : en;
  const steps = ar ? ["المستثمر والكيان", "الاسم التجاري", "الأنشطة التجارية", "الشركاء ورأس المال", "المراجعة والإرسال"] : ["Investor & legal form", "Trade name", "Commercial activities", "Partners & capital", "Review & submit"];
  const activities = [{
    code: "62010",
    desc: "Computer programming activities",
    isic: "ISIC 4"
  }, {
    code: "70200",
    desc: "Management consultancy activities",
    isic: "ISIC 4"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 32px",
      maxWidth: 1180,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "sw-icon-btn",
    style: {
      border: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ar ? "arrow-right" : "arrow-left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--text-xs)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-caps)",
      color: "var(--brand)",
      fontWeight: 600
    }
  }, t("Establish a company", "تأسيس شركة")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "2px 0 0",
      fontSize: "var(--text-xl)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, "Commercial activities")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginInlineStart: "auto",
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "save",
    size: 16
  }), " ", t("Draft saved", "تم حفظ المسودة"), " \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      direction: "ltr"
    }
  }, "SW-2026-118418"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "240px 1fr",
      gap: 24,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "14px"
  }, /*#__PURE__*/React.createElement(Stepper, {
    steps: steps,
    current: 2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Entity details",
    padding: "20px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Legal form",
    required: true,
    defaultValue: "Limited Liability (W.L.L.)"
  }, /*#__PURE__*/React.createElement("option", null, "Limited Liability (W.L.L.)"), /*#__PURE__*/React.createElement("option", null, "Single Person Company (S.P.C.)"), /*#__PURE__*/React.createElement("option", null, "Qatari Shareholding (Q.P.S.C.)"), /*#__PURE__*/React.createElement("option", null, "Branch of a foreign company")), /*#__PURE__*/React.createElement(Select, {
    label: "Investor type",
    defaultValue: "Local investor"
  }, /*#__PURE__*/React.createElement("option", null, "Local investor"), /*#__PURE__*/React.createElement("option", null, "GCC investor"), /*#__PURE__*/React.createElement("option", null, "Foreign investor")), /*#__PURE__*/React.createElement(Input, {
    label: "Reserved trade name",
    defaultValue: "Lusail Ventures",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "tag",
      size: 17
    })
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Proposed capital (QAR)",
    defaultValue: "200,000",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 17
    })
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Commercial activities",
    eyebrow: "2 selected",
    padding: "0",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "scan-search",
        size: 16
      })
    }, "Search activities")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      textAlign: "left",
      color: "var(--text-subtle)",
      fontSize: "var(--text-xs)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-wide)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 20px",
      fontWeight: 600
    }
  }, "Activity code"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, "Description"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 12px",
      fontWeight: 600
    }
  }, "Classification"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "12px 20px",
      fontWeight: 600
    }
  }))), /*#__PURE__*/React.createElement("tbody", null, activities.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderTop: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 20px",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--text-strong)"
    }
  }, l.code), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px",
      fontSize: "var(--text-sm)",
      color: "var(--text-body)"
    }
  }, l.desc), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 12px"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, l.isic)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "14px 20px",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn",
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 15,
    color: "var(--text-muted)"
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 20px",
      background: "var(--surface-sunken)",
      borderTop: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)"
    }
  }, "Estimated registration & service fees"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, "QAR 3,200"))), /*#__PURE__*/React.createElement(Card, {
    padding: "18px",
    style: {
      background: "var(--info-bg)",
      borderColor: "var(--info-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 20,
    color: "var(--info)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, "One activity may require an additional approval"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-body)",
      marginTop: 3
    }
  }, "Activity 62010 is unregulated, but some classes need a competent-authority permit. Single Window will route any required approvals automatically.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: t("I confirm the selected activities match my intended business.", "أؤكد أن الأنشطة المختارة تطابق عملي المستهدف."),
    defaultChecked: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, t("Save & exit", "حفظ وخروج")), /*#__PURE__*/React.createElement(Button, {
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: ar ? "arrow-left" : "arrow-right",
      size: 18
    }),
    onClick: onSubmit
  }, t("Continue", "متابعة")))))));
}
Object.assign(window, {
  EstablishCompany
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/EstablishCompany.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/Login.jsx
try { (() => {
// Login — real Single Window landing: TAWTHEEQ / QDI sign-in card + hero.
function Login({
  onLogin,
  lang = "en",
  onToggleLang
}) {
  const rtl = lang === "ar";
  const t = (en, ar) => rtl ? ar : en;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      background: "var(--surface-card)"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "14px 28px",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    variant: "wide",
    height: 42
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginInlineStart: "auto",
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn",
    title: "Accessibility"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 19
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleLang,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-body)",
      fontFamily: rtl ? "var(--font-sans)" : "var(--font-arabic)",
      fontSize: 14,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 15,
      borderRadius: 2,
      overflow: "hidden",
      display: "inline-flex",
      border: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      background: "#8a1538"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: "#fff"
    }
  })), rtl ? "English" : "العربية"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      padding: "8px 18px",
      border: "1.5px solid var(--brand-strong)",
      borderRadius: "var(--radius-pill)",
      color: "var(--brand-strong)",
      fontWeight: 600,
      fontSize: 14
    }
  }, t("SignUp / Login", "تسجيل الدخول")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(120deg, var(--blue-900) 0%, var(--blue-700) 55%, var(--blue-500) 100%)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(360px, 0.85fr) 1fr",
      gap: 40,
      alignItems: "center",
      padding: "56px 48px",
      maxWidth: 1320,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onLogin();
    },
    style: {
      background: "#fff",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-xl)",
      padding: "28px 30px",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      paddingBottom: 14,
      borderBottom: "2px solid var(--brand)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontWeight: 700,
      fontSize: 24,
      color: "var(--brand)"
    }
  }, "\u062A\u0640\u0648\u062B\u0640\u064A\u0640\u0642"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: ".14em",
      color: "#c0392b"
    }
  }, "TAWTHEEQ")), /*#__PURE__*/React.createElement("span", {
    style: {
      marginInlineStart: "auto",
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.1,
      textAlign: "end"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontWeight: 600,
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, "\u0647\u0648\u064A\u0629 \u0642\u0637\u0631 \u0627\u0644\u0631\u0642\u0645\u064A\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-subtle)"
    }
  }, "Qatar Digital Identity"))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: "var(--text-muted)",
      textAlign: "center"
    }
  }, t("Doesn't have account yet?", "ليس لديك حساب؟"), " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--text-link)",
      fontWeight: 700,
      textDecoration: "underline"
    }
  }, t("Sign Up", "إنشاء حساب"))), /*#__PURE__*/React.createElement(Input, {
    placeholder: t("Enter Username", "أدخل اسم المستخدم"),
    defaultValue: "ahmed.eldaraa",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 18
    })
  }), /*#__PURE__*/React.createElement(Input, {
    type: "password",
    placeholder: t("Enter 6 character or more", "٦ أحرف أو أكثر"),
    defaultValue: "password",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 18
    })
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: 13,
      color: "var(--text-link)",
      fontWeight: 600,
      textDecoration: "underline"
    }
  }, t("Forgot Password?", "نسيت كلمة المرور؟")), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    size: "lg",
    block: true
  }, t("LOGIN", "تسجيل الدخول")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      color: "var(--text-subtle)",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--border-subtle)"
    }
  }), t("OR", "أو"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--border-subtle)"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onLogin,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 50,
      border: "none",
      borderRadius: "var(--radius-pill)",
      background: "var(--blue-100)",
      color: "var(--brand-strong)",
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 15,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "credit-card",
    size: 19
  }), " ", t("Login with Smart Card", "الدخول بالبطاقة الذكية"))), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#fff",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark-transparent.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      insetInlineEnd: -40,
      top: -20,
      width: 360,
      opacity: 0.12
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "var(--text-4xl)",
      fontWeight: 800,
      margin: 0,
      letterSpacing: "var(--tracking-tight)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)"
    }
  }, t("START", "ابدأ")), " ", t("YOUR BUSINESS", "عملك")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-md)",
      lineHeight: 1.6,
      color: "rgba(255,255,255,.88)",
      maxWidth: 520,
      marginTop: 18,
      position: "relative"
    }
  }, t("Start your business from Single Window — your business setup made simple, safe, and easy.", "ابدأ عملك من النافذة الواحدة — تأسيس أعمالك بطريقة بسيطة وآمنة وسهلة.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 28
    }
  }, [0, 1, 2, 3, 4].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: i === 1 ? 22 : 9,
      height: 9,
      borderRadius: 999,
      background: i === 1 ? "var(--accent)" : "rgba(255,255,255,.45)"
    }
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--blue-800)",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "26px 48px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: "var(--text-lg)",
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)"
    }
  }, t("PROCEDURES", "دليل إجراءات")), " ", t("MANUAL OF THE MINISTRY OF COMMERCE AND INDUSTRY", "وزارة التجارة والصناعة")), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "rgba(255,255,255,.9)",
      fontSize: 14,
      textDecoration: "underline",
      display: "inline-block",
      marginTop: 8
    }
  }, t("Procedures Manual of the Ministry of Commerce and Industry", "دليل إجراءات وزارة التجارة والصناعة")))), /*#__PURE__*/React.createElement(MociFooter, {
    lang: lang
  }));
}
Object.assign(window, {
  Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/Shell.jsx
try { (() => {
// Shell — white top header + thin gold-active icon rail + MoCI footer.
function Shell({
  active,
  onNavigate,
  onLogout,
  lang = "en",
  onToggleLang,
  children
}) {
  const {
    user,
    nav
  } = window.SWData;
  const rtl = lang === "ar";
  const T = window.SWStrings ? window.SWStrings(lang) : {};
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
      background: "var(--surface-page)"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-subtle)",
      position: "sticky",
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "10px 24px"
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    variant: "wide",
    height: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginInlineStart: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn",
    title: "Accessibility"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 19
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleLang,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-body)",
      fontFamily: rtl ? "var(--font-sans)" : "var(--font-arabic)",
      fontSize: 14,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 15,
      borderRadius: 2,
      overflow: "hidden",
      display: "inline-flex",
      border: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      background: "#8a1538"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: "#fff"
    }
  })), rtl ? "English" : "العربية"), /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn",
    title: "Notifications"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, "0")), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "2px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: user.name,
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, user.name), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15,
    color: "var(--text-muted)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn sm",
    title: "Search"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 18,
    color: "var(--brand)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "sw-icon-btn sm",
    title: "Dashboard"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gauge",
    size: 18,
    color: "var(--brand)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "sw-hamburger",
    title: "Menu"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 72,
      flex: "none",
      background: "var(--surface-card)",
      borderInlineEnd: "1px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "16px 0"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "sw-rail",
    title: "Menu",
    style: {
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  })), nav.map(n => {
    const on = n.key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: n.key,
      onClick: () => onNavigate(n.key),
      title: T[n.key] || n.label,
      className: "sw-rail",
      "data-on": on,
      style: {
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--blue-900)" : "var(--neutral-500)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 21
    }));
  }), /*#__PURE__*/React.createElement("button", {
    className: "sw-rail",
    title: "Settings",
    style: {
      color: "var(--neutral-500)",
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 20
  }))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, children)), /*#__PURE__*/React.createElement(MociFooter, {
    lang: lang
  }));
}
Object.assign(window, {
  Shell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/data.js
try { (() => {
// Single Window (MoCI Qatar) — Investor Portal demo data (fictional, illustrative)
window.SWData = {
  user: {
    name: "Layla Al-Marri",
    nameAr: "ليلى المرّي",
    org: "QDI · Qatar Digital Identity",
    role: "Local investor"
  },
  stats: [{
    key: "active",
    label: "Active applications",
    labelAr: "الطلبات النشطة",
    value: "6",
    delta: "+2 this week",
    deltaAr: "+٢ هذا الأسبوع",
    tone: "brand",
    icon: "files"
  }, {
    key: "action",
    label: "Awaiting your action",
    labelAr: "بانتظار إجراء منك",
    value: "3",
    delta: "2 due this week",
    deltaAr: "٢ مستحقة هذا الأسبوع",
    tone: "warning",
    icon: "clock"
  }, {
    key: "entities",
    label: "Registered entities",
    labelAr: "المنشآت المسجّلة",
    value: "4",
    delta: "All in good standing",
    deltaAr: "جميعها سارية",
    tone: "success",
    icon: "building-2"
  }, {
    key: "fees",
    label: "Fees payable",
    labelAr: "الرسوم المستحقة",
    value: "QAR 12,400",
    delta: "2 invoices",
    deltaAr: "فاتورتان",
    tone: "info",
    icon: "wallet"
  }],
  // Applications / transactions tracked in the single dashboard
  applications: [{
    id: "SW-2026-118402",
    service: "Establish a company",
    entity: "Lusail Ventures W.L.L.",
    form: "Limited Liability (W.L.L.)",
    value: "Capital QAR 200,000",
    status: "review",
    agency: "Commercial Registration",
    updated: "20 min ago",
    flag: "Awaiting trade-name approval"
  }, {
    id: "SW-2026-118377",
    service: "Industrial license",
    entity: "Doha Precision Mfg.",
    form: "Industrial facility",
    value: "SME industrial land",
    status: "submitted",
    agency: "Industrial Development",
    updated: "2 hr ago"
  }, {
    id: "SW-2026-118351",
    service: "Trade name reservation",
    entity: "Marsa Design Studio",
    form: "Trade name",
    value: "—",
    status: "approved",
    agency: "Commercial Registration",
    updated: "Yesterday"
  }, {
    id: "SW-2026-118340",
    service: "CR amendment — add activity",
    entity: "Qatar Trading Co. W.L.L.",
    form: "Commercial registration",
    value: "+1 activity",
    status: "hold",
    agency: "Commercial Affairs",
    updated: "Yesterday",
    flag: "Municipality approval required"
  }, {
    id: "SW-2026-118318",
    service: "Establish a company",
    entity: "Al Wakra Foods W.L.L.",
    form: "Limited Liability (W.L.L.)",
    value: "Capital QAR 50,000",
    status: "draft",
    agency: "—",
    updated: "2 days ago"
  }, {
    id: "SW-2026-118290",
    service: "CR renewal",
    entity: "Gulf Pharma S.P.C.",
    form: "Commercial registration",
    value: "QAR 3,000",
    status: "rejected",
    agency: "Commercial Registration",
    updated: "3 days ago",
    flag: "Lease attestation expired"
  }],
  tasks: [{
    label: "Approve reserved trade name",
    ref: "SW-2026-118402",
    due: "Today",
    tone: "warning"
  }, {
    label: "Pay commercial registration fee",
    ref: "INV-2026-77310",
    due: "This week",
    tone: "info"
  }, {
    label: "Re-upload attested lease contract",
    ref: "SW-2026-118290",
    due: "Overdue",
    tone: "danger"
  }],
  // Quick services on the dashboard
  services: [{
    label: "Establish a company",
    labelAr: "تأسيس شركة",
    icon: "building-2",
    desc: "Incorporate a new entity",
    descAr: "تأسيس منشأة جديدة"
  }, {
    label: "Reserve a trade name",
    labelAr: "حجز اسم تجاري",
    icon: "tag",
    desc: "Check & book a name",
    descAr: "تحقق واحجز اسماً"
  }, {
    label: "Search commercial activities",
    labelAr: "البحث عن الأنشطة",
    icon: "scan-search",
    desc: "Activities & requirements",
    descAr: "الأنشطة والمتطلبات"
  }, {
    label: "Industrial license & land",
    labelAr: "رخصة وأرض صناعية",
    icon: "factory",
    desc: "SME industrial area",
    descAr: "المنطقة الصناعية للمشاريع"
  }, {
    label: "Amend a CR",
    labelAr: "تعديل سجل تجاري",
    icon: "file-pen",
    desc: "Activities, partners, capital",
    descAr: "الأنشطة والشركاء ورأس المال"
  }, {
    label: "Pay fees",
    labelAr: "دفع الرسوم",
    icon: "wallet",
    desc: "Consolidated invoices",
    descAr: "فواتير موحّدة"
  }],
  nav: [{
    key: "dashboard",
    label: "Dashboard",
    labelAr: "لوحة التحكم",
    icon: "layout-dashboard"
  }, {
    key: "applications",
    label: "Applications",
    labelAr: "الطلبات",
    icon: "files",
    badge: 6
  }, {
    key: "entities",
    label: "My entities",
    labelAr: "منشآتي",
    icon: "building-2"
  }, {
    key: "activities",
    label: "Commercial activities",
    labelAr: "الأنشطة التجارية",
    icon: "scan-search"
  }, {
    key: "payments",
    label: "Payments",
    labelAr: "المدفوعات",
    icon: "wallet"
  }, {
    key: "documents",
    label: "Documents",
    labelAr: "مستنداتي",
    icon: "folder"
  }]
};

// Shell rail tooltip labels by language.
window.SWStrings = function (lang) {
  const ar = lang === "ar";
  const out = {};
  window.SWData.nav.forEach(n => {
    out[n.key] = ar ? n.labelAr : n.label;
  });
  return out;
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/data.js", error: String((e && e.message) || e) }); }

// ui_kits/investor-portal/kit-icons.jsx
try { (() => {
// Icon — thin wrapper over Lucide (institutional 1.75px stroke).
// Renders an <i data-lucide> placeholder; App calls lucide.createIcons() after render.
function Icon({
  name,
  size = 20,
  color,
  style,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "lu " + className,
    style: {
      width: size,
      height: size,
      color,
      display: "inline-flex",
      flex: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": name
  }));
}

// Single Window logo lockup (mark + optional wordmark) used in shells/headers.
function Brand({
  variant = "mark",
  height = 34,
  light = false
}) {
  const src = "../../assets/logo-mark-transparent.png";
  if (variant === "wide") {
    return /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-wide.png",
      alt: "Single Window",
      style: {
        height
      }
    });
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      height
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.05
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontWeight: 700,
      fontSize: height * 0.42,
      color: light ? "#fff" : "var(--brand-deep)"
    }
  }, "\u0627\u0644\u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0648\u0627\u062D\u062F\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: height * 0.34,
      letterSpacing: "0.02em",
      color: light ? "rgba(255,255,255,.92)" : "var(--brand-deep)"
    }
  }, "SINGLE WINDOW")));
}

// MoCI footer — shared across portal screens.
function MociFooter({
  lang = "en"
}) {
  const cols = [["Information Center", ["Investor Information", "Help Articles", "FAQ's"]], ["Search Tools", ["Trade Name Search", "Business Activities Search", "Business Setup Advisor"]], ["Service", ["Service Catalog", "Consulting and Clearance Agencies", "Under Liquation and Closed Firms"]]];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--brand-deep)",
      color: "rgba(255,255,255,.82)",
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      padding: "48px 32px 0",
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1.1fr",
      gap: 28
    }
  }, cols.map(([h, items]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "#fff",
      margin: "0 0 16px",
      textTransform: "uppercase",
      letterSpacing: ".06em"
    }
  }, h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "flink"
  }, it)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontSize: 17,
      fontWeight: 700,
      color: "#fff"
    }
  }, "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0635\u0646\u0627\u0639\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#fff"
    }
  }, "Ministry of Commerce and Industry"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(255,255,255,.7)"
    }
  }, "State of Qatar \xB7 \u062F\u0648\u0644\u0629 \u0642\u0637\u0631")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      fontSize: 13,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 16
  }), " Lusail \xB7 Qatar"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 16
  }), " 16001")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, ["facebook", "instagram", "twitter", "youtube", "linkedin"].map(s => /*#__PURE__*/React.createElement("a", {
    key: s,
    href: "#",
    className: "social"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s,
    size: 16
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid rgba(255,255,255,.14)",
      marginTop: 40,
      background: "var(--blue-950)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      padding: "18px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      fontSize: 12.5,
      color: "rgba(255,255,255,.8)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark-transparent.png",
    alt: "",
    style: {
      height: 30
    }
  }), " All Rights Reserved 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 22,
      fontSize: 12.5
    }
  }, ["Contact Us", "Customer Charter", "User Disclaimer", "Privacy Policy"].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    className: "flink",
    style: {
      textTransform: "uppercase",
      letterSpacing: ".04em"
    }
  }, l))))));
}
Object.assign(window, {
  Icon,
  Brand,
  MociFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/investor-portal/kit-icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-website/ActivityDetail.jsx
try { (() => {
// Business Activity details — mirrors the activity detail page.
function Field({
  label,
  children,
  color
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)",
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 600,
      color: color || "var(--brand-strong)"
    }
  }, children));
}
function PanelCard({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)",
      padding: "22px 26px",
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 18px",
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: "var(--brand-strong)"
    }
  }, title), children);
}
function ActivityDetail({
  onBack,
  lang = "en"
}) {
  const rtl = lang === "ar";
  const t = (en, ar) => rtl ? ar : en;
  const feeRows = [[t("Commercial", "تجاري"), t("Commercial Location", "موقع تجاري"), "500 QAR"], [t("Industrial", "صناعي"), t("Workshop", "ورشة"), "500 QAR"]];
  const nats = [t("Allowed for Foreigners", "مسموح للأجانب"), t("Allowed for GCC", "مسموح لدول الخليج"), t("Allowed for Local Ownership", "مسموح للملكية المحلية")];
  const approvals = [t("Before Deletion of the Commercial Permit", "قبل حذف التصريح التجاري"), t("Before Renewal of the Commercial Permit", "قبل تجديد التصريح التجاري"), "Branch-CP-Issue-Pre", t("Pre Issue CP Approvals", "موافقات ما قبل إصدار التصريح")];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageBanner, {
    title: t("Business Activity Details", "تفاصيل النشاط التجاري"),
    crumbs: [t("Home", "الرئيسية"), t("Information Center", "مركز المعلومات"), t("Business Activities Search", "البحث عن الأنشطة"), t("Business Activity Details", "تفاصيل النشاط")]
  }), /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "30px 24px 64px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "26px 32px"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: t("Business Activity Code", "رمز النشاط التجاري")
  }, "452081"), /*#__PURE__*/React.createElement(Field, {
    label: t("Status", "الحالة"),
    color: "var(--success-fg)"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, t("Active", "نشط"), " ", /*#__PURE__*/React.createElement(Icon, {
    name: "check-circle",
    size: 17,
    color: "var(--success)"
  }))), /*#__PURE__*/React.createElement(Field, {
    label: t("Business Activity Name", "اسم النشاط التجاري")
  }, t("Tyre and tube repair, fitting or replacement for passenger motor vehicles", "إصلاح وتركيب أو استبدال الإطارات للمركبات")), /*#__PURE__*/React.createElement(Field, {
    label: t("Business Activity Description", "وصف النشاط التجاري")
  }, t("Tyre and tube repair, fitting or replacement for passenger motor vehicles", "إصلاح وتركيب أو استبدال إطارات المركبات")), /*#__PURE__*/React.createElement(Field, {
    label: t("Taxonomies Exclusions", "الاستثناءات")
  }, "\u2014"), /*#__PURE__*/React.createElement(Field, {
    label: t("Taxonomies Inclusions", "الإدراجات")
  }, "\u2014"), /*#__PURE__*/React.createElement(Field, {
    label: t("Group Fee in the Commercial Registration", "رسوم المجموعة في السجل التجاري")
  }, "500 QAR")), /*#__PURE__*/React.createElement(PanelCard, {
    title: t("Activity fee in the Commercial Permits", "رسوم النشاط في التصاريح التجارية")
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--blue-50)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: rtl ? "right" : "left",
      padding: "14px 18px",
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Main Location Classification", "تصنيف الموقع الرئيسي")), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: rtl ? "right" : "left",
      padding: "14px 18px",
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Sub Location Type", "نوع الموقع الفرعي")), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: rtl ? "right" : "left",
      padding: "14px 18px",
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Fee", "الرسوم")))), /*#__PURE__*/React.createElement("tbody", null, feeRows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderTop: "1px solid var(--border-subtle)"
    }
  }, r.map((c, j) => /*#__PURE__*/React.createElement("td", {
    key: j,
    style: {
      padding: "14px 18px",
      fontSize: "var(--text-sm)",
      color: "var(--text-body)",
      fontWeight: j === 2 ? 600 : 400
    }
  }, c))))))), /*#__PURE__*/React.createElement(PanelCard, {
    title: t("Business Requirements", "متطلبات النشاط")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "240px 1fr"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      background: "var(--blue-50)",
      fontWeight: 700,
      fontSize: "var(--text-sm)",
      color: "var(--text-strong)"
    }
  }, t("Age", "العمر")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      fontSize: "var(--text-sm)"
    }
  }, t("All Ages", "جميع الأعمار")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      background: "var(--blue-50)",
      fontWeight: 700,
      fontSize: "var(--text-sm)",
      color: "var(--text-strong)",
      borderTop: "1px solid var(--border-subtle)"
    }
  }, t("Allowed Nationalities", "الجنسيات المسموحة")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      borderTop: "1px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, nats.map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: "var(--text-sm)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15,
    color: "var(--success)"
  }), " ", n)))))), /*#__PURE__*/React.createElement(PanelCard, {
    title: t("Required Approvals", "الموافقات المطلوبة")
  }, /*#__PURE__*/React.createElement("div", null, approvals.map((a, i) => /*#__PURE__*/React.createElement(Accordion, {
    key: i,
    title: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-base)",
        fontWeight: 500
      }
    }, i + 1 + ". " + a)
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-muted)"
    }
  }, t("Approval details and the responsible entity are shown here.", "تفاصيل الموافقة والجهة المسؤولة تظهر هنا.")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onBack,
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: rtl ? "arrow-right" : "arrow-left",
      size: 17
    })
  }, t("Back to services", "العودة إلى الخدمات")))));
}
Object.assign(window, {
  ActivityDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-website/ActivityDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-website/Catalog.jsx
try { (() => {
// Services catalog — searchable, accordion categories of hexagon service cards.
const SW_CATALOG = [{
  key: "start",
  en: "Start Your Business",
  ar: "تأسيس الأعمال",
  open: true,
  services: [{
    icon: "scan-search",
    en: "Start Your Business",
    desc: "This service enables investors to reserve a Trade Name and obtain Commercial Registration. It also supports establishing a Professional Office."
  }, {
    icon: "file-cog",
    en: "Commercial Registration / Professional License / Home License",
    desc: "For investors who have already reserved a Trade Name, this service enables them to obtain a Commercial Registration and license."
  }, {
    icon: "file-check",
    en: "License Your Business",
    desc: "This service enables investors to obtain a Commercial License after securing the necessary Commercial Registration."
  }, {
    icon: "factory",
    en: "Factory Establishment",
    desc: "Reserve a Trade Name and issue a Commercial Registration for industrial establishments, with Industrial Development approvals."
  }, {
    icon: "file-cog",
    en: "Resume Factory Establishment",
    desc: "For investors who have initiated factory establishment, complete the remaining setup procedures and renew initial approval."
  }, {
    icon: "house",
    en: "Home License Issuance",
    desc: "Enables individuals to obtain an official license to carry out a commercial or professional activity from home."
  }, {
    icon: "bot",
    en: "Business Setup Advisor",
    desc: "Get a quick, personalised advisory on requirements, fees, documents and timelines before you start."
  }, {
    icon: "user-check",
    en: "Foreign Investor Eligibility Check",
    desc: "Allows non-resident foreigners to check their eligibility to invest in Qatar prior to establishing a company."
  }]
}, {
  key: "manage",
  en: "Manage Your Business",
  ar: "إدارة الأعمال",
  services: []
}, {
  key: "grow",
  en: "Grow Your Business",
  ar: "تنمية الأعمال",
  services: []
}, {
  key: "close",
  en: "Close Your Business",
  ar: "إغلاق الأعمال",
  services: []
}, {
  key: "certs",
  en: "Certificates Services",
  ar: "خدمات الشهادات",
  services: []
}];
function Catalog({
  onOpenService,
  lang = "en"
}) {
  const rtl = lang === "ar";
  const t = (en, ar) => rtl ? ar : en;
  const [open, setOpen] = React.useState("start");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageBanner, {
    title: t("Services", "الخدمات"),
    crumbs: [t("Home", "الرئيسية"), t("Service Catalogue", "دليل الخدمات")]
  }), /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "26px 24px 64px"
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, t("Search your service", "ابحث عن خدمة")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--blue-50)",
      border: "1px solid var(--blue-100)",
      borderRadius: "var(--radius-lg)",
      padding: 18,
      margin: "22px 0 36px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      insetInlineStart: 16,
      color: "var(--text-subtle)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 20
  })), /*#__PURE__*/React.createElement("input", {
    placeholder: t("Type your service name…", "اكتب اسم الخدمة…"),
    style: {
      width: "100%",
      height: 56,
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "0 18px 0 48px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-md)",
      color: "var(--text-strong)",
      background: "#fff"
    }
  }))), SW_CATALOG.map(cat => {
    const isOpen = open === cat.key;
    return /*#__PURE__*/React.createElement("div", {
      key: cat.key,
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpen(isOpen ? null : cat.key),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "10px 0",
        borderBottom: "2px solid var(--accent)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "2px solid var(--brand)",
        color: "var(--brand)",
        display: "grid",
        placeItems: "center",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "minus" : "plus",
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-lg)",
        fontWeight: 700,
        color: "var(--text-strong)",
        textTransform: "uppercase",
        letterSpacing: ".02em"
      }
    }, t(cat.en, cat.ar))), isOpen && cat.services.length ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 18,
        marginTop: 24
      }
    }, cat.services.map((sv, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => onOpenService(sv),
      className: "svc-card",
      style: {
        textAlign: rtl ? "right" : "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column"
      }
    }, /*#__PURE__*/React.createElement(HexIcon, {
      name: sv.icon,
      size: 26
    }), /*#__PURE__*/React.createElement("h3", {
      style: {
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        color: "var(--text-strong)",
        margin: "16px 0 8px",
        textTransform: "uppercase",
        letterSpacing: ".02em",
        lineHeight: 1.35
      }
    }, sv.en), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: "var(--text-xs)",
        color: "var(--text-muted)",
        lineHeight: 1.6,
        margin: 0
      }
    }, sv.desc)))) : null);
  })));
}
Object.assign(window, {
  Catalog,
  SW_CATALOG
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-website/Catalog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-website/ServiceDetail.jsx
try { (() => {
// Service detail — mirrors the "Start Your Business" service page.
function Accordion({
  title,
  children,
  open: openInit = false
}) {
  const [open, setOpen] = React.useState(openInit);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(!open),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "18px 4px",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, title), /*#__PURE__*/React.createElement(Icon, {
    name: open ? "chevron-up" : "chevron-down",
    size: 20,
    color: "var(--brand)"
  })), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 4px 22px",
      fontSize: "var(--text-base)",
      color: "var(--text-body)",
      lineHeight: 1.7
    }
  }, children) : null);
}
function ServiceDetail({
  service,
  onBack,
  onOpenActivity,
  lang = "en"
}) {
  const rtl = lang === "ar";
  const t = (en, ar) => rtl ? ar : en;
  const entities = ["Ministry of Commerce and Industry", "Ministry of Endowments and Islamic Affairs", "Civil Aviation Authority", "Communications Regulatory Authority", "General Authority of Customs", "Ministry of Education and Higher Education", "General Tax Authority", "Ministry of Municipality", "Ministry of Finance", "Ministry of Interior", "Ministry of Public Health", "Qatar Chamber", "Qatar Financial Centre"];
  const related = [{
    icon: "circle-plus",
    en: "Add Branch",
    desc: "For companies that want to add a new branch and identify the activities practiced in it."
  }, {
    icon: "file-cog",
    en: "Commercial Registration / Professional License / Home License",
    desc: "Resume the activities required to set up a business based on an already-reserved trade name."
  }, {
    icon: "factory",
    en: "Factory Establishment",
    desc: "MoCI offers industrial lands for promising industrial projects; Qatar Development Bank finances such projects."
  }, {
    icon: "file-check",
    en: "License Your Business",
    desc: "Apply for a commercial permit after completing the establishment procedures."
  }];
  const bullets = ["Trade Name", "Commercial Registration", "Memorandum of Association (MoA)", "Commercial Permit", "Establishment ID (EID)", "Tax Card", "Labor Approvals", "Specific licenses based on the selected activities"];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageBanner, {
    title: t("Start Your Business", "تأسيس الأعمال"),
    crumbs: [t("Home", "الرئيسية"), t("Services", "الخدمات"), t("Start Your Business", "تأسيس الأعمال")]
  }), /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "26px 24px 64px"
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, t("Start Your Business", "تأسيس الأعمال")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: 32,
      marginTop: 24,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 28,
      flexWrap: "wrap",
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)",
      padding: "22px 26px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "timer",
    size: 26,
    color: "var(--accent-strong)"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)"
    }
  }, t("Cycle Time (Approx.)", "المدة (تقريباً)")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, t("Two to three days", "يومان إلى ثلاثة")))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 40,
      background: "var(--border-subtle)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "coins",
    size: 26,
    color: "var(--accent-strong)"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)"
    }
  }, t("Cost (Approx.)", "التكلفة (تقريباً)")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, "QAR 1,700"))), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    style: {
      marginInlineStart: "auto"
    }
  }, t("Start service", "ابدأ الخدمة"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Accordion, {
    title: t("Descriptions", "الوصف"),
    open: true
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 12px"
    }
  }, t("This service allows the investor to obtain all the necessary licenses to start engaging in economic business in one transaction. Required procedures and approvals are automatically determined according to the components of the entity — legal structure, activity, capital and location. This service results in a Commercial Registration (CR).", "تتيح هذه الخدمة للمستثمر الحصول على جميع التراخيص اللازمة لبدء النشاط الاقتصادي في معاملة واحدة. تُحدَّد الإجراءات والموافقات تلقائياً وفق مكوّنات الكيان — الشكل القانوني والنشاط ورأس المال والموقع. تنتج عن هذه الخدمة سجل تجاري.")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, t("The following transactions can be completed through this service:", "يمكن إنجاز المعاملات التالية من خلال هذه الخدمة:")), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingInlineStart: 22,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "6px 24px"
    }
  }, bullets.map(b => /*#__PURE__*/React.createElement("li", {
    key: b
  }, b)))), [t("Persona Type", "نوع الشخصية"), t("Eligibility", "الأهلية"), t("Conditions", "الشروط"), t("Process", "الإجراءات"), t("Required Document List", "قائمة المستندات المطلوبة"), t("Fees", "الرسوم")].map(s => /*#__PURE__*/React.createElement(Accordion, {
    key: s,
    title: s
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-muted)"
    }
  }, t("Details available when you start the service.", "التفاصيل متاحة عند بدء الخدمة."))))), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: "var(--text-strong)",
      margin: "36px 0 18px"
    }
  }, t("Relevant Services", "خدمات ذات صلة")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 18
    }
  }, related.map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => onOpenActivity && onOpenActivity(),
    className: "svc-card",
    style: {
      textAlign: rtl ? "right" : "left",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(HexIcon, {
    name: r.icon,
    size: 24
  }), /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-strong)",
      margin: 0,
      textTransform: "uppercase",
      letterSpacing: ".02em"
    }
  }, r.en)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-muted)",
      lineHeight: 1.6,
      margin: "12px 0 0"
    }
  }, r.desc))))), /*#__PURE__*/React.createElement("aside", {
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      padding: "16px 18px",
      background: "var(--brand-deep)",
      color: "#fff",
      fontSize: "var(--text-base)",
      fontWeight: 700
    }
  }, t("Relevant Entity", "الجهات المعنية")), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0
    }
  }, entities.map((e, i) => /*#__PURE__*/React.createElement("li", {
    key: e,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "13px 16px",
      borderBottom: i < entities.length - 1 ? "1px solid var(--border-subtle)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: "var(--text-xs)",
      color: "var(--text-body)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: "var(--radius-sm)",
      background: "var(--blue-50)",
      color: "var(--brand)",
      display: "grid",
      placeItems: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "landmark",
    size: 14
  })), e), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15,
    color: "var(--text-subtle)"
  }))))))));
}
Object.assign(window, {
  ServiceDetail,
  Accordion
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-website/ServiceDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-website/kit-icons.jsx
try { (() => {
// Public site chrome — Icon, Brand, PublicHeader, PageBanner, MociFooter.
function Icon({
  name,
  size = 20,
  color,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "lu",
    style: {
      width: size,
      height: size,
      color,
      display: "inline-flex",
      flex: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": name
  }));
}
function Brand({
  light = false,
  height = 40
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark-transparent.png",
    alt: "",
    style: {
      height
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.04
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontWeight: 700,
      fontSize: height * 0.4,
      color: light ? "#fff" : "var(--brand-deep)"
    }
  }, "\u0627\u0644\u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0648\u0627\u062D\u062F\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: height * 0.32,
      letterSpacing: "0.02em",
      color: light ? "rgba(255,255,255,.9)" : "var(--brand-deep)"
    }
  }, "SINGLE WINDOW")));
}
function PublicHeader({
  lang = "en",
  onToggleLang
}) {
  const rtl = lang === "ar";
  const t = (en, ar) => rtl ? ar : en;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-subtle)",
      position: "sticky",
      top: 0,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20,
      minHeight: 78,
      padding: "10px 24px"
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    height: 42
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginInlineStart: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "pub-icon",
    title: "Accessibility"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 19
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleLang,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-body)",
      fontFamily: rtl ? "var(--font-sans)" : "var(--font-arabic)",
      fontSize: 14,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 15,
      borderRadius: 2,
      overflow: "hidden",
      display: "inline-flex",
      border: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      background: "#8a1538"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: "#fff"
    }
  })), rtl ? "English" : "العربية"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      padding: "9px 22px",
      border: "1.5px solid var(--brand-strong)",
      borderRadius: "var(--radius-pill)",
      color: "var(--brand-strong)",
      fontWeight: 600,
      fontSize: 14,
      cursor: "pointer"
    }
  }, t("SignUp / Login", "تسجيل الدخول"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "pub-icon",
    title: "Search"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 19,
    color: "var(--brand)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "sw-hamburger",
    title: "Menu"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  }))))));
}
function PageBanner({
  title,
  crumbs = []
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hexbanner",
    style: {
      background: "linear-gradient(110deg, var(--blue-900) 0%, var(--blue-700) 55%, var(--blue-500) 100%)",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "44px 24px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: "var(--text-2xl)",
      fontWeight: 800,
      letterSpacing: ".06em",
      textTransform: "uppercase"
    }
  }, title))), crumbs.length ? /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "16px 24px 0"
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: "var(--text-sm)",
      flexWrap: "wrap"
    }
  }, crumbs.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-subtle)"
    }
  }, "/") : null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: i === crumbs.length - 1 ? "var(--accent-strong)" : "var(--text-link)",
      fontWeight: i === crumbs.length - 1 ? 600 : 500
    }
  }, c))))) : null);
}
function SectionTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      margin: "0 0 4px",
      fontSize: "var(--text-xl)",
      fontWeight: 700,
      color: "var(--text-strong)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 28,
      background: "var(--accent)",
      borderRadius: 2,
      flex: "none"
    }
  }), children);
}
function HexIcon({
  name,
  size = 30
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "hexicon",
    style: {
      width: size + 22,
      height: size + 26
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: size,
    color: "var(--accent-strong)"
  }));
}
function MociFooter({
  lang = "en"
}) {
  const cols = [["Information Center", ["Investor Information", "Help Articles", "FAQ's"]], ["Search Tools", ["Trade Name Search", "Business Activities Search", "Business Setup Advisor"]], ["Service", ["Service Catalog", "Consulting and Clearance Agencies", "Under Liquation and Closed Firms"]]];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--brand-deep)",
      color: "rgba(255,255,255,.82)",
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "48px 24px 0",
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1.1fr",
      gap: 28
    }
  }, cols.map(([h, items]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "#fff",
      margin: "0 0 16px",
      textTransform: "uppercase",
      letterSpacing: ".06em"
    }
  }, h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "flink"
  }, it)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-arabic)",
      fontSize: 17,
      fontWeight: 700,
      color: "#fff"
    }
  }, "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0635\u0646\u0627\u0639\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#fff"
    }
  }, "Ministry of Commerce and Industry"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(255,255,255,.7)"
    }
  }, "State of Qatar \xB7 \u062F\u0648\u0644\u0629 \u0642\u0637\u0631")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      fontSize: 13,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 16
  }), " Lusail \xB7 Qatar"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 16
  }), " 16001")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, ["facebook", "instagram", "twitter", "youtube", "linkedin"].map(s => /*#__PURE__*/React.createElement("a", {
    key: s,
    href: "#",
    className: "social"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s,
    size: 16
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid rgba(255,255,255,.14)",
      marginTop: 40,
      background: "var(--blue-950)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      padding: "18px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark-transparent.png",
    alt: "",
    style: {
      height: 30
    }
  }), " All Rights Reserved 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 22,
      fontSize: 12.5
    }
  }, ["Contact Us", "Customer Charter", "User Disclaimer", "Privacy Policy"].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    className: "flink",
    style: {
      textTransform: "uppercase",
      letterSpacing: ".04em"
    }
  }, l))))));
}
Object.assign(window, {
  Icon,
  Brand,
  PublicHeader,
  PageBanner,
  SectionTitle,
  HexIcon,
  MociFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-website/kit-icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-website/site-app.jsx
try { (() => {
// Public website — router across catalog, service detail, activity detail.
function Site() {
  const [route, setRoute] = React.useState("catalog");
  const [lang, setLang] = React.useState("en");
  const [service, setService] = React.useState(null);
  const rtl = lang === "ar";
  React.useLayoutEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      attrs: {
        "stroke-width": 1.75
      }
    });
    document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  });
  const toggleLang = () => setLang(l => l === "en" ? "ar" : "en");
  let screen;
  if (route === "service") {
    screen = /*#__PURE__*/React.createElement(ServiceDetail, {
      service: service,
      lang: lang,
      onBack: () => setRoute("catalog"),
      onOpenActivity: () => setRoute("activity")
    });
  } else if (route === "activity") {
    screen = /*#__PURE__*/React.createElement(ActivityDetail, {
      lang: lang,
      onBack: () => setRoute("catalog")
    });
  } else {
    screen = /*#__PURE__*/React.createElement(Catalog, {
      lang: lang,
      onOpenService: sv => {
        setService(sv);
        setRoute("service");
        window.scrollTo(0, 0);
      }
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(PublicHeader, {
    lang: lang,
    onToggleLang: toggleLang
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1
    }
  }, screen), /*#__PURE__*/React.createElement(MociFooter, {
    lang: lang
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(Site, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-website/site-app.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
