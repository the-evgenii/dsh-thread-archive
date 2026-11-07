# Third-party components

`client.js` includes package-local adaptations of Button, Switch, Checkbox, Input,
SegmentedControl and their styles from `@deepseek-ai/dsh-client-ui-primitives`
version `0.2.2-rc.1`:
https://unpkg.com/@deepseek-ai/dsh-client-ui-primitives@0.2.2-rc.1/

Adaptations: React.createElement instead of compiled JSX; local `daa-` class names;
only used button variants; theme-aware focus and reduced-motion styling; compact
language tabs with a matching tabpanel; no runtime import of Harness internals.
Field layout and input metrics follow native settings-form fields (SettingsValueField),
as used by Telegram Sync: labels above full-width inputs, 12px row padding and thin
dividers. Numeric input constraints are retained. Switch rows use the same native
Switch with the compact Telegram Sync spacing.

## MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
