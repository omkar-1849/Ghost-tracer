import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("Login Redesign - Design tokens match large floating glass panel specification", async () => {
    const tokensRaw = await readFile(resolve(process.cwd(), "../sentinel-ai-login-design-tokens.json"), "utf8");
    const tokens = JSON.parse(tokensRaw);

    assert.equal(tokens.color.background.canvas.$value, "#080909");
    assert.equal(tokens.color.background.surface.$value, "rgba(22, 23, 26, 0.48)");
    assert.equal(tokens.color.text.primary.$value, "#F0F0ED");
    assert.equal(tokens.color.text.secondary.$value, "#AAA9A5");
    assert.equal(tokens.color.accent.buttonBg.$value, "#2E3035");
    assert.equal(tokens.radius.panel.$value, "28px");
    assert.equal(tokens.dimensions.inputHeight.$value, "50px");
    assert.equal(tokens.dimensions.buttonHeight.$value, "50px");
    assert.equal(tokens.dimensions.panelMaxWidth.$value, "520px");
    assert.equal(tokens.effect.glassBlur.$value, "20px");
    assert.equal(tokens.background.image.$value, "/loginback.png");
});

test("Login Redesign - Login.css implements floating liquid glass material & proportions", async () => {
    const cssContent = await readFile(resolve(process.cwd(), "src/pages/Login.css"), "utf8");

    // Background image checks
    assert.ok(cssContent.includes("url('/loginback.png')"), "Must use loginback.png as background");
    assert.ok(cssContent.includes("background-size: cover"), "Background size must be cover");

    // 3-layer architecture check
    assert.ok(cssContent.includes(".sentinel-login-bg-layer"), "Must have Layer 1: Dedicated background layer");
    assert.ok(cssContent.includes(".sentinel-login-scrim"), "Must have Layer 2: Readability scrim");
    assert.ok(cssContent.includes(".sentinel-login-foreground"), "Must have Layer 3: Interactive foreground layout");

    // Floating liquid glass panel material
    assert.ok(cssContent.includes("backdrop-filter: blur(var(--snl-glass-blur))"), "Backdrop filter blur present");
    assert.ok(cssContent.includes("--snl-radius-panel: 28px"), "28px panel radius present");
    assert.ok(cssContent.includes("--snl-input-height: 50px"), "50px input height present");
    assert.ok(cssContent.includes("--snl-btn-height: 50px"), "50px button height present");
    assert.ok(cssContent.includes("--snl-panel-max-width: 520px"), "520px panel max-width present");
    assert.ok(cssContent.includes(":-webkit-autofill"), "Autofill overrides present");

    // Responsive and accessibility checks
    assert.ok(cssContent.includes("@media (max-width: 48rem)"), "Mobile breakpoint (48rem) present");
    assert.ok(cssContent.includes("prefers-reduced-motion: reduce"), "prefers-reduced-motion present");
    assert.ok(cssContent.includes(":focus-visible"), "Focus visible styling present");
});

test("Login Redesign - Login.jsx renders SOC descriptor, refined hierarchy, and accessible form controls", async () => {
    const jsxContent = await readFile(resolve(process.cwd(), "src/pages/Login.jsx"), "utf8");

    // 4 required features
    assert.ok(jsxContent.includes("Autonomous Threat Detection"), "Feature 1 present");
    assert.ok(jsxContent.includes("Real-time Incident Response"), "Feature 2 present");
    assert.ok(jsxContent.includes("Predictive Behavioral Analytics"), "Feature 3 present");
    assert.ok(jsxContent.includes("Threat Intelligence"), "Feature 4 present");

    // Icons: ShieldCheck, Activity, BrainCircuit, Fingerprint, LockKeyhole, ArrowRight
    assert.ok(jsxContent.includes("ShieldCheck"), "ShieldCheck icon imported");
    assert.ok(jsxContent.includes("Fingerprint"), "Fingerprint icon imported");
    assert.ok(jsxContent.includes("LockKeyhole"), "LockKeyhole icon imported");
    assert.ok(jsxContent.includes("ArrowRight"), "ArrowRight icon imported");

    // Panel branding & typography
    assert.ok(jsxContent.includes("SECURITY OPERATIONS CENTER"), "SOC descriptor present");
    assert.ok(jsxContent.includes("Sign in to Console"), "Heading present");
    assert.ok(jsxContent.includes("Access your security operations environment"), "Supporting text present");

    // Left hero title & supporting copy
    assert.ok(jsxContent.includes("INTELLIGENT"), "Headline line 1 present");
    assert.ok(jsxContent.includes("SECURITY OPERATIONS"), "Headline line 2 present");

    // Verified trust messaging
    assert.ok(jsxContent.includes("Use a trusted HTTPS deployment for remote access"), "HTTPS trust note present");

    // Checkbox and accessibility
    assert.ok(jsxContent.includes("Remember Me"), "Remember me option present");
    assert.ok(jsxContent.includes("Forgot password?"), "Single forgot password link present");
    assert.ok(jsxContent.includes("Authenticate Session"), "Primary button label present");
    assert.ok(jsxContent.includes("aria-label"), "Accessible icon buttons present");
});
