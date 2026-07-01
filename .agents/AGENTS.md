# Geometry-TD Workspace Rules

## HUD & UI State Synchronization
- **Authoritative Mutations**: When updating authoritative game state values (like `state.gold` or `state.lives`) inside tick-based or passive loops (such as tower updates), you must immediately trigger a UI update.
- **Trigger Call**: Invoke `Multiplayer.updateUI()` right after mutating the state to keep HUD elements in sync across singleplayer and host-client sessions. Do not rely on other updates (like enemy deaths) to refresh the display.

## Windows Terminal Compatibility
- **PowerShell Chaining Limit**: Avoid chaining terminal commands using the `&&` operator when proposing or running commands under Windows PowerShell (which defaults to version 5.1).
- **Alternative Syntax**: Instead, separate commands, use `;` as a statement separator, or wrap the full command in `cmd /c "command1 && command2"`.

## TypeScript Solution Projects (Multi-Root IDE Support)
- **Root Configuration**: In repositories with separate `frontend` and `backend` subdirectories, ensure there is a solution-style `tsconfig.json` in the root folder with references pointing to each subfolder. This allows IDE language servers to resolve cross-package dependencies and Node type imports accurately.

## Headless Execution & Circular Dependencies
- **Decoupled Validation Helpers**: Pure geometry, math, or coordinate validation functions (such as cell permissions) must never reside in modules that interact with the DOM or window elements (like `ui.ts` or `events.ts`). 
- **Decoupling Strategy**: Place all pure helper functions in dedicated, dependency-free utility modules (e.g., `utils.ts`) to avoid circular imports. This prevents runtime `TypeErrors` (e.g. function is undefined) during Headless Browser (Puppeteer) simulation ticks.

## Multiplayer State Synchronization & Animation Continuity
- **Animation Time Accumulation**: Keep incrementing `state.animTime` even when the game is paused so that UI overlays, hover circles, range indicators, and visual highlights continue to animate.
- **Client-Side Entity Reconciliation**: When parsing collections of synced entities (such as towers) from the host, ensure the client reconciles its local list by identifying and destroying/splicing local instances whose positions or IDs are missing from the synced payload list.
- **Attribute-Triggered Redraws**: When copying properties (like `ownerIndex`) from synced payloads to reconstructed client entities, explicitly call any downstream rendering functions (like `tower.drawOwnerGlow?.()`) afterward. Constructors may initialize graphics with default local attributes before the synced payload attributes are applied.
- **Passive Animation in Paused Loops**: Update floating texts, visual notifications, and UI particle/label arrays in the game loop's paused `else` branch, so that user feedback elements triggered during pause do not freeze in a microscopic or initial state.

## Grid-Path Consistency Validation
- **Waypoint to Grid Matrix Matching**: When modifying, resizing, or creating grid-based maps, ensure there is 100% cell-by-cell path validation. For every waypoint segment in the path sequence:
  - Identify all grid coordinates (row/column indices) spanned by the segment.
  - Verify that each spanned coordinate is explicitly marked as path (`1`) in the map definition matrix, rather than buildable (`0`).
  - Gaps in path cells will cause the renderer to draw border boundaries or cyber tech brackets across the active path, visual artifacts, and path disjointedness.

## WebRTC Delta Compression & Baseline Sync
- **Array Copying in Serialization**: In tick-based WebRTC delta serialization, any state arrays (such as `playerGolds`, `playerSlots`, `playerRelocationStates`) must be cloned (e.g., using `[...arr]`) during serialization payload creation. Because delta encoders compare arrays using reference checks, in-place mutations of state arrays will fail to trigger delta detection and prevent updates from being sent.
- **Out-of-Band Baseline Alignment**: When the client receives authoritative out-of-band updates (like Socket.io messages `sync_gold` or `player_slots_update`) that modify state arrays, always update the client's local baseline `Multiplayer.lastReceivedState` with a copy of the new arrays. This prevents next tick WebRTC delta reconstructions from reverting the client state to stale values.

