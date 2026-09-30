# Third-party components and fonts

The application code is independently authored. Its interface consumes public Wornpage Svelte packages, installed from immutable release archives rather than copied from Projects. Archive URLs and SHA-512 integrity hashes are retained in `package-lock.json`.

| Package | Version | Immutable release | Used for |
|---|---|---|---|
| @wornpage/button | 0.2.3 | components-2026.09.26 | Actions and refresh control |
| @wornpage/form-fields | 0.1.3 | components-2026.09.26 | Conversation textarea |
| @wornpage/disclosure | 0.1.2 | components-2026.09.26 | Work details, connection details, tool traces |
| @wornpage/tabs | 0.1.2 | components-2026.09.26 | Keyboard selection of work and decisions |
| @wornpage/alert | 0.1.3 | components-2026.09.26 | Errors, saved decisions, provider availability |
| @wornpage/data-display | 0.1.12 | components-2026.09.27.2 | Badges and ChangePreview for proposals and history |

These packages are MIT licensed, copyright 2026 Wornpage. The public repository license is included at [wornpage-mit.txt](../public/licenses/wornpage-mit.txt), including the notice absent from the Button package archive. Sources: [September 26 release](https://github.com/wornpage/components/releases/tag/components-2026.09.26), [data-display release](https://github.com/wornpage/components/releases/tag/components-2026.09.27.2), [canonical license](https://github.com/wornpage/components/blob/components-2026.09.26/LICENSE).

The browser bundle also uses Svelte under MIT. DM Sans and Manrope fonts are bundled from Fontsource under the SIL Open Font License 1.1. Their complete notices are included in `public/licenses/` and copied into the built site. Other npm dependencies retain the notices distributed in their installed packages.
