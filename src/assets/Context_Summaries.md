
# Application Context Summaries

This document provides a summary of each of the React Contexts used in the inventory management application. Each summary outlines the context's purpose, its data sources, and the key information or functions it provides to the application.

---

### 1. `AuthContext.jsx`

*   **Purpose:** The `AuthContext` is the foundation of the application's authentication and database connection. It manages the user's login state, provides the core Firestore database instance (`db`), and, most importantly, determines if the application is currently online or offline.
*   **Data Sources:**
    *   **Firebase Authentication:** Handles user sign-in, sign-out, and session management.
    *   **Browser's `navigator.onLine`:** Used to detect the online/offline status of the application.
*   **Outputs:**
    *   `currentUser`, `userId`: Information about the logged-in user.
    *   `db`: The Firestore database instance, essential for all database operations.
    *   `appId`: The unique identifier for the application instance.
    *   `isOnline`: A critical boolean flag that is `true` if the app has an internet connection and `false` otherwise.
    *   `authReady`: A flag to indicate that the authentication state has been checked and is ready.

---

### 2. `UserContext.jsx`

*   **Purpose:** Manages the profile data for the currently logged-in user. This is distinct from authentication; it handles user-specific application data, like their display name or assigned work locations.
*   **Data Sources:**
    *   **Firestore:** Listens to the `/artifacts/{appId}/users/{userId}/profile/data` document for the user's specific profile information.
*   **Outputs:**
    *   `user`: An object containing the user's profile data (e.g., `displayName`, `assignedLocations`).
    *   `isLoading`: A boolean to indicate if the user profile is being loaded.

---

### 3. `SyncContext.jsx`

*   **Purpose:** The cornerstone of the app's offline functionality. It provides a queue for operations that happen when the user is offline. When an action like `stockOut` is called without a connection, it gets added to this queue. When the app comes back online, this context processes the queue to sync the changes with Firestore.
*   **Data Sources:**
    *   **LocalForage (`pending_writes`):** Persists the queue of pending actions in local storage, ensuring no data is lost even if the browser is closed.
*   **Outputs:**
    *   `addToQueue`: The function other contexts use to add a pending action to the queue.
    *   `pendingWritesCount`: A number indicating how many items are in the sync queue, useful for UI feedback.
    *   `isSyncing`: A boolean that is `true` while the context is actively syncing the queue with Firestore.

---

### 4. `InventoryContext.jsx`

*   **Purpose:** Manages the most dynamic data: the individual inventory items. It knows how many of each product exist, where they are located, and what their status is.
*   **Data Sources:**
    *   **Firestore:** Listens to `/artifacts/{appId}/inventory_items` for real-time updates when online.
    *   **LocalForage (`inventoryItemsCache`):** Caches the inventory list for offline access.
*   **Outputs:**
    *   `inventoryItems`: The complete list of every item in inventory.
    *   `stockLevels`: A pre-calculated summary object showing the count of each product (SKU) at each location.
    *   `stockOut`, `transfer`: Functions that handle inventory changes. They intelligently use the `SyncContext` to queue actions when offline.
    *   `addBatchToInventory`: An online-only function to add new items received from a purchase order.

---

### 5. `ProductContext.jsx`

*   **Purpose:** Manages the master catalog of all products the business sells. It is responsible for the core definition of a product (SKU, brand, model, etc.).
*   **Data Sources:**
    *   **Firestore:** Listens to `/artifacts/{appId}/products` for a real-time product list.
    *   **LocalForage (`productsCache`):** Caches the product catalog for offline viewing.
*   **Outputs:**
    *   `products`: The array of all product definition objects.
    *   `createProduct`, `updateProduct`: Online-only functions for managing the product catalog.

---

### 6. `CustomerContext.jsx`

*   **Purpose:** Manages the application's list of customers. It provides a real-time customer list when online and falls back to a local cache when offline.
*   **Data Sources:**
    *   **Firestore:** Listens to `/artifacts/{appId}/customers` for real-time updates.
    *   **LocalForage (`customersCache`):** Caches the customer list for offline access.
*   **Outputs:**
    *   `customers`: The array of all customer objects.
    *   `addCustomer`, `updateCustomer`, `deleteCustomer`: Online-only functions for managing customer data.

---

### 7. `SupplierContext.jsx`

*   **Purpose:** Manages the list of suppliers. It handles creating, updating, and deleting suppliers and is responsible for generating unique, sequential IDs for them (e.g., `SUP-001`).
*   **Data Sources:**
    *   **Firestore:** Connects to `/artifacts/{appId}/suppliers` and uses `/artifacts/{appId}/counters/supplierCounter` for ID generation. This is an online-only context.
*   **Outputs:**
    *   `suppliers`: The array of all supplier objects.
    *   `addSupplier`, `updateSupplier`, `deleteSupplier`: Functions for managing supplier data.

---

### 8. `PurchaseInvoiceContext.jsx`

*   **Purpose:** Manages purchase invoices, which are the records of orders placed with suppliers. It contains the critical logic for moving items from a pending state to the main inventory.
*   **Data Sources:**
    *   **Firestore:** Connects to `/artifacts/{appId}/purchaseInvoices` for real-time data. This is an online-only context.
*   **Outputs:**
    *   `invoices`: The list of all purchase invoices.
    *   `addStockItems`: A crucial transactional function that updates an invoice's status and adds the received items to the main inventory in a single, atomic operation.

---

### 9. `SalesContext.jsx`

*   **Purpose:** Responsible for managing all sales orders within the application.
*   **Data Sources:**
    *   **Firestore:** Connects to the `/artifacts/{appId}/sales` collection for live updates. This is an online-only context.
*   **Outputs:**
    *   `salesOrders`: An array containing all sales order objects.
    *   `createSalesOrder`: An online-only function to create a new sales order.

---

### 10. `LocationContext.jsx`

*   **Purpose:** Manages the list of physical locations or warehouses where inventory is stored.
*   **Data Sources:**
    *   **Firestore:** Listens to `/artifacts/{appId}/locations`.
    *   **LocalForage (`locationsCache`):** Caches the location list for offline access.
*   **Outputs:**
    *   `locations`: The array of location objects.
    *   `addLocation`: An online-only function that also automatically assigns the new location to the user who created it.

---

### 11. `LookupContext.jsx`

*   **Purpose:** Manages small, miscellaneous lists of data like product `brands` and `categories`.
*   **Data Sources:**
    *   **Firestore:** Listens to a single document at `/artifacts/{appId}/lookups/metadata`.
    *   **LocalForage (`lookupsCache`):** Caches the data for offline use.
*   **Outputs:**
    *   `lookups`: An object where keys are the lookup type (e.g., "brands") and values are arrays of items.
    *   `addLookupItem`: An online-only function to add new items to a lookup list.

---

### 12. `PendingReceivablesContext.jsx`

*   **Purpose:** A highly specialized context that tracks inventory items that have been ordered from a supplier but have not yet been received into the main inventory.
*   **Data Sources:**
    *   **Firestore:** Performs a live query on the `/artifacts/{appId}/pending_stock` collection. This is an online-only context.
*   **Outputs:**
    *   `pendingReceivables`: The array of items currently on order.
    *   `removeReceivables`: A function to remove items from this list in a batch, likely used when the items are officially received.

---

### 13. `LoadingContext.jsx`

*   **Purpose:** Provides a simple, global state for managing a full-screen loading overlay to prevent user interaction during major background operations.
*   **Data Sources:** None. This is purely for managing UI state.
*   **Outputs:**
    *   `isAppProcessing`: A boolean that is `true` when the global overlay should be visible.
    *   `setAppProcessing`: A function to show or hide the overlay.
