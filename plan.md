# Prompt to Make Existing Frontend Pages Dynamic

You are an expert full-stack developer. My project already has the core backend, authentication, and major features implemented. Your task is **NOT** to rebuild the backend. Instead, make the specified frontend pages fully dynamic using the existing backend architecture.

specified frontend pages
In admin panel and mla-connect panel
under Geo-mapping sidebar 
@NewLocationTab
1. add location 
2. All locations 
3. Bookmarked
## Instructions

1. **Analyze the selected frontend page completely before making changes.**

   * Identify every field displayed.
   * Identify every button, form, modal, table, card, filter, search box, dropdown, pagination, status badge, image, and action.
   * Do not miss any UI element.

2. **Connect the page to the backend.**

   * Reuse existing APIs whenever possible.
   * Only create new APIs if the required functionality does not already exist.
   * Do not duplicate existing backend logic.

3. **Database Changes**

   * If additional database fields or tables are absolutely necessary, create them.
   * For every schema change, create a **separate MySQL migration/schema SQL file**.
   * Never modify previous migration files.
   * Examples:

     * `008_add_product_discount.sql`
     * `009_create_vendor_settings.sql`
     * `010_add_order_tracking.sql`

4. **Maintain Existing UI**

   * Do NOT change the design.
   * Do NOT modify styling.
   * Do NOT alter spacing, colors, typography, or responsiveness.
   * Do NOT rename existing components or props unless absolutely necessary.
   * Preserve the exact user experience.

5. **Dynamic Functionality**
   Replace all hardcoded or mock data with backend data.

   Ensure the page supports:

   * Fetching data
   * Creating records
   * Updating records
   * Deleting records
   * Searching
   * Filtering
   * Sorting
   * Pagination
   * Image uploads (if applicable)
   * Status updates
   * Loading indicators
   * Empty states
   * Error handling
   * Success messages

6. **Validation**

   * Match frontend and backend validation.
   * Display user-friendly validation and API error messages.

7. **Performance**

   * Avoid unnecessary API calls.
   * Use efficient state management.
   * Keep components reusable and clean.

8. **Deliverables**
   For every page you update, provide:

   * Updated frontend components
   * Any new backend controller/service/route (only if required)
   * Separate MySQL migration/schema SQL files for any database changes
   * API integration
   * Validation
   * Loading and error states

9. **Final Verification**
   Before marking the task complete, verify that:

   * Every visible field is backed by real data.
   * Every button performs its intended action.
   * All forms submit correctly.
   * All CRUD operations work.
   * Search, filters, and pagination work correctly.
   * No hardcoded data remains.
   * The UI design remains unchanged.
   * Existing backend functionality is not broken.

**Important:** Do not make unnecessary architectural changes. Reuse existing backend code wherever possible. Only add backend endpoints or database changes if the current backend cannot support the required functionality. If new database changes are needed, create a separate versioned MySQL migration/schema SQL file for each change.

Draft me a detailed Plan first 