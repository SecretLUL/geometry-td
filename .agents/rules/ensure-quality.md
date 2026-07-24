---
trigger: always_on
---

1. Documentation Duty (Changelog & README)

Every functional change made to the project must be documented immediately. You are required to update the following files:

* `/frontend/public/assets/changelog.json` (Entries are rendered directly in the main menu changelog tab).
* `README.md` (Keep the documentation aligned with any changes to local setup, ports, or architectural shifts).

2. Typography & Font Rules (BLADRMF_.TTF)

When designing UI components, menus, or text elements that utilize the custom font **`BLADRMF_.TTF`**, the following rule is absolute:

* **Strict Lowercase Only:** All text using this font must be written in lowercase letters.
* **Reason:** Uppercase characters (such as the capital "R") in this specific font render as custom logos rather than regular text characters and will break the intended text layout.