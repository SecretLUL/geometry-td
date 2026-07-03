---
trigger: always_on
---

### 1. The 60-FPS & Zero-Allocation Mandate
* **Garbage Collection (GC) Prevention:** The game relies on a high-performance 60-FPS rendering loop using PixiJS v8. Frequent memory allocations inside the game loop that cause GC spikes or stuttering are strictly forbidden.
* **No Direct Instantiation:** Frequently created and destroyed entities—such as projectiles, enemies, particle effects (FX), or floating combat texts—must **never** be instantiated using the `new` keyword if an object pool exists.

### 2. Mandatory Object Pool Workflow (`pool.ts`)
You must strictly adhere to the centralized pooling mechanism provided in `pool.ts`:

* **Acquisition:** Always retrieve existing object instances from the pool using the dedicated getter method (e.g., `pool.get(...)`).
* **Strict Re-Initialization:** Every object retrieved from the pool must be explicitly and cleanly reset before being rendered or simulated. This includes resetting positions, velocities, state flags, active targets, and health points to prevent state bleeding.
* **Mandatory Release:** As soon as an entity dies, leaves the map bounds, or becomes inactive, it must be instantly released back to the pool (e.g., `pool.release(object)`) to prevent memory leaks.