import scopeStudio from "./postcss-scope-studio.mjs";

const config = {
  plugins: [
    "@tailwindcss/postcss",
    // After Tailwind, never before: it has to see the finished stylesheet,
    // utilities and Preflight included, or it would only scope what we wrote
    // by hand and leave the generated majority loose on the host page.
    scopeStudio(),
  ],
};

export default config;
