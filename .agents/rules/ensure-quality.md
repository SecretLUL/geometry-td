---
trigger: always_on
---

### 1. Mandatory Pre-Commit Validation
Whenever code changes are completed, you must run the appropriate validation scripts from the project root directory:

* **To validate the entire project (Highly Recommended before any commit):**

    npm run check-all

    *This executes backend type checks, as well as frontend lints, Prettier formatting checks, and the production build.*

* **To validate frontend changes only:**

    npm run check-all:frontend

* **To validate backend changes only:**

    npm run check:backend


### 2. Auto-Formatting Protocol
If any frontend validation check fails due to code formatting or style guide deviations (Prettier violations), you auto-format the frontend codebase immediately using the following commands:

cd frontend && npm run format

### 3. Documentation Duty (Changelog & README)

Every functional change made to the project must be documented immediately. You are required to update the following files:

* `/frontend/public/assets/changelog.json` (Entries are rendered directly in the main menu changelog tab).
* `README.md` (Keep the documentation aligned with any changes to local setup, ports, or architectural shifts).

### 4. Typography & Font Rules (BLADRMF_.TTF)

When designing UI components, menus, or text elements that utilize the custom font **`BLADRMF_.TTF`**, the following rule is absolute:

* **Strict Lowercase Only:** All text using this font must be written in lowercase letters.
* **Reason:** Uppercase characters (such as the capital "R") in this specific font render as custom logos rather than regular text characters and will break the intended text layout.