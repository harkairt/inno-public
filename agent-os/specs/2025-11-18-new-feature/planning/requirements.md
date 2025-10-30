# Spec Requirements: Add Users to Chat Session

## Initial Description

Add functionality to allow users to add other participants (both real users and AI agents) to existing chat sessions. This feature enables dynamic participant management within ongoing conversations, supporting vonno's core mission of treating all participants equally regardless of whether they are human or AI.

Users should be able to add new participants to active chat sessions through an intuitive UI element located in the chat interface. When viewing a chat session, users will see a "+" button with a schematic portrait icon on the chatbar (where the existing member list is displayed). Clicking this button will open a selection interface showing all available users who aren't already in the chat, allowing single-user addition at a time.

## Requirements Discussion

### First Round Questions

**Q1: Should this spec cover both UI and backend integration, or just the UI?**
**Answer:** UI first - we'll use the UI to test the integration code correctness.

**Q2: Where should the "add user" action be accessed from?**
**Answer:** On the chatbar there's already a list of agents added to the chat. On the very left there should be a + button with a schematic portrait icon so users understand they're adding participants.

**Q3: What should the user selection UI look like?**
**Answer:** All good, but NO need for "online status". YES, exclude existing users from the selection list.

**Q4: How should we provide visual feedback when a user is added?**
**Answer:** Just update the UI accordingly (add to member list), NO need for synthetic chat message.

**Q5: How should we handle errors?**
**Answer:** Good (toast notification approach).

**Q6: What permissions should govern who can add users?**
**Answer:** Free for all - any member can add users.

**Q7: Should we support adding multiple users at once?**
**Answer:** Single user addition, one at a time.

**Q8: What are the completion criteria?**
**Answer:** It's already possible to check which users are added, so that can be used to assess completion.

**Q9: Are there existing features in your codebase with similar patterns we should reference?**
**Answer:** User did not specify any specific similar features to reference.

### Existing Code to Reference

**Backend Integration Patterns:**

The following existing composables and services should be leveraged:

1. **useAddUserToSession()** mutation - Located at `/app/composables/useChatMutations.ts:510-536`
   - Handles API call to add user to session
   - Automatically invalidates session queries on success
   - Provides error handling structure
   - Returns TanStack Query mutation object

2. **useSelectableUsers()** query - Located at `/app/composables/useUsers.ts:27-60`
   - Fetches all selectable users (agents + real users)
   - Returns UserDTO[] with user information including avatars
   - Has built-in caching (5 min stale time)
   - Auto-refetches every 10 minutes

3. **useChatStore** - Located at `/app/stores/chat.ts`
   - Manages chat session state including members array
   - Provides activeSession computed property
   - Contains updateSession() action for local state updates

**Data Models:**

- **ChatSession** interface includes `members: string[]` field (user codes)
- **UserDTO** interface provides user information for display
- Backend service already implements `addUserToSession(params: AddUserToSessionRequestDTO)`

**Similar UI Patterns:**

No specific similar features were identified by the user for UI pattern reference.

### Follow-up Questions

No follow-up questions were needed. All requirements were clarified in the first round.

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Insights:

No visual assets were available for analysis. The feature will follow existing UI patterns from the vonno chat interface, particularly the chatbar component where member lists are currently displayed.

## Requirements Summary

### Feature Goal

Enable users to dynamically add new participants (real users and AI agents) to existing chat sessions through a simple, accessible UI control that integrates seamlessly with the existing chatbar interface.

### User Stories

**As a chat participant:**
- I want to add new users to my ongoing chat session so that I can include additional people or AI agents in the conversation
- I want to see which users are available to add so that I can make informed decisions about who to invite
- I want users already in the chat to be excluded from the selection list so that I don't accidentally try to add someone twice
- I want immediate visual confirmation when a user is added so that I know my action succeeded
- I want clear error messages if something goes wrong so that I can understand what happened

**As a product designer:**
- I want the add user control to be discoverable but unobtrusive so that users can easily find it without cluttering the interface
- I want the portrait icon to communicate the action clearly so that users understand they're adding participants
- I want the feature to follow existing patterns so that users feel comfortable using it

### Functional Requirements

**FR1: Add User Button**
- Display a "+" button on the left side of the chatbar (where existing member list is shown)
- Include a schematic portrait icon to indicate adding participants
- Button should be visible and accessible when viewing any active chat session
- Button should be available to all chat members (no permission restrictions)

**FR2: User Selection Interface**
- Clicking the "+" button opens a selection interface (modal, dropdown, or popover)
- Display all selectable users from `useSelectableUsers()` composable
- Exclude users already in the current session (filter out users in `activeSession.members`)
- Show user names and avatars for easy identification
- Do NOT display online status indicators
- Support single-user selection (no batch/multi-select)

**FR3: Add User Action**
- Upon user selection, call `useAddUserToSession()` mutation with session ID and selected user ID
- Show loading state during API call
- Close selection interface on successful addition

**FR4: Visual Feedback**
- Update member list UI immediately upon successful addition
- Show newly added user in the chatbar member list
- Do NOT generate synthetic chat messages (e.g., "User X joined")
- Leverage TanStack Query's automatic cache invalidation to refresh session data

**FR5: Error Handling**
- Display toast notification for any errors during the add user operation
- Show user-friendly error messages (not technical details)
- Keep selection interface open on error so user can retry
- Handle common error scenarios:
  - Network failures
  - API errors
  - Session not found
  - User already in session (edge case)

**FR6: Accessibility**
- Ensure "+" button is keyboard navigable
- Provide appropriate ARIA labels for screen readers
- Ensure selection interface is accessible via keyboard
- Follow WCAG standards per vonno's accessibility-first principles

### UI/UX Specifications

**Button Placement:**
- Position: Left side of the chatbar
- Icon: Schematic portrait icon (indicates adding people)
- Symbol: "+" to indicate addition action
- Visual style: Consistent with existing chatbar controls
- Size: Appropriate for touch targets (minimum 44x44px tap area)

**Selection Interface:**
- Type: To be determined (modal, dropdown, or popover - choose based on existing patterns)
- Content: List of available users
- Item format: User avatar + name
- Filtering: Pre-filtered to exclude current members
- Selection: Single-click to add
- Empty state: Message if no additional users available
- Close behavior: Dismiss on selection or outside click/Esc key

**Member List Update:**
- Timing: Immediate upon successful API response
- Animation: Smooth transition (optional, based on existing patterns)
- Display: Show new member alongside existing members
- Ordering: Consistent with existing member list ordering

**Loading States:**
- Button: Disabled state while API call is in progress
- Selection interface: Loading spinner or skeleton while fetching users
- Feedback: Visual indication that action is processing

**Error Display:**
- Method: Toast notification (as specified)
- Duration: Auto-dismiss after 5-7 seconds with option to dismiss manually
- Content: User-friendly error message
- Position: Consistent with existing toast notifications in vonno

### Technical Approach

**Composables to Use:**

1. **useAddUserToSession()**
   - Import from `@/app/composables/useChatMutations`
   - Call mutation with `{ sessionId: string, userId: number }`
   - Handle `onSuccess` callback to close selection UI
   - Handle `onError` callback to show toast notification

2. **useSelectableUsers()**
   - Import from `@/app/composables/useUsers`
   - Fetch all available users
   - Filter results to exclude current session members
   - Cache leverages existing 5-minute stale time

3. **useChatStore()**
   - Import from `@/app/stores/chat`
   - Access `activeSession` to get current session ID and members list
   - Optionally use `updateSession()` for optimistic updates

**Data Flow:**

1. User clicks "+" button
2. Selection interface opens
3. Component calls `useSelectableUsers()` to fetch available users
4. Component filters out users in `activeSession.members`
5. User selects a participant
6. Component calls `addUserToSession.mutate({ sessionId, userId })`
7. On success:
   - TanStack Query invalidates session queries (automatic)
   - UI updates to show new member
   - Selection interface closes
8. On error:
   - Display toast notification
   - Keep selection interface open

**State Management:**

- Component-level state for selection interface open/closed
- TanStack Query for server state (users list, session data)
- Pinia store for session data access (read-only)
- No manual cache updates needed (TanStack Query handles it)

**Component Structure:**

```
AddUserToSessionButton.vue
├── Props: sessionId (optional if using activeSession from store)
├── Composables: useAddUserToSession, useSelectableUsers, useChatStore
├── Local State: isSelectionOpen
├── Computed: availableUsers (filtered list)
└── Methods: openSelection, closeSelection, handleAddUser
```

**Integration Points:**

- Backend API: Already implemented via `chatService.addUserToSession()`
- State updates: Automatic via query invalidation
- UI location: Chatbar component (where members are displayed)

**Technologies:**

- Vue 3.5 Composition API
- TypeScript 5.6+
- Nuxt UI 4.1 components (for button, modal/dropdown, toast)
- TanStack Query 5.90 (mutation and query)
- Pinia 0.11 (store access)
- neverthrow 8.2 (error handling in services)
- zod 4.1 (validation if needed)

### Reusability Opportunities

**Potential Existing Components to Reuse:**

While no specific similar features were identified by the user, the following existing patterns may be applicable:

- User list display patterns from UserListItem.vue or similar components
- Modal/dropdown patterns from existing Nuxt UI components
- Toast notification system (likely already implemented in the app)
- Avatar display components for user representation
- Button styling from existing chatbar controls

**Backend Patterns to Follow:**

- Use existing mutation error handling patterns from useChatMutations.ts
- Follow existing query invalidation patterns (automatic via onSuccess)
- Leverage existing UserDTO type for user display data

### Scope Boundaries

**In Scope:**

- "+" button with portrait icon on chatbar
- User selection interface with filtered user list
- Single user addition via API integration
- Immediate UI updates to member list
- Toast notifications for errors
- Keyboard accessibility for all interactions
- Excluding current members from selection list
- Integration with existing composables and services

**Out of Scope:**

- Batch/multi-user addition
- Online status indicators in user list
- Synthetic chat messages announcing user additions
- Permission/role-based access control (all members can add)
- Backend API implementation (already exists)
- Removing users from sessions (separate feature on roadmap)
- User search/filter in selection interface (can be added later if list is long)
- Invitation system for users not yet on the platform
- Notifications to added users that they've been added

**Future Enhancements:**

- Search/filter in user selection if user base grows large
- Batch addition for adding multiple users at once
- User invitation system
- Admin-only add permissions for certain session types
- Notifications when added to a session

### Technical Considerations

**Integration Points:**

- Chatbar component: Primary integration point for the "+" button
- Member list component: May need updates to reflect new members
- Toast notification system: For error display

**Existing System Constraints:**

- Must work within Vue 3.5/Nuxt 4.2 framework
- Must follow Composition API patterns
- Must use TanStack Query for data fetching
- Must integrate with existing chat store
- Must follow TypeScript strict mode
- Must be PWA-compatible (works offline with graceful degradation)

**Technology Preferences:**

- Use Nuxt UI components (UButton, UModal/UDropdown, UToast, etc.)
- Follow script setup syntax for Vue components
- Use composables for logic reuse
- Implement proper TypeScript types
- Use neverthrow Result types for error handling in services (already implemented)
- Follow existing component patterns and naming conventions

**Similar Code Patterns to Follow:**

- Mutation patterns from useChatMutations.ts (error handling, invalidation)
- Query patterns from useUsers.ts (caching, refetch strategies)
- Store usage patterns from existing chat components
- Component structure from existing chat UI components

**Performance Considerations:**

- Leverage TanStack Query caching to avoid redundant API calls
- Filter users client-side (small dataset, no need for server-side filtering)
- Use optimistic updates if appropriate (optional enhancement)
- Ensure smooth UI transitions without janky animations

**Accessibility Requirements:**

- Keyboard navigation for all controls
- ARIA labels for button and selection interface
- Screen reader announcements for state changes
- Focus management when opening/closing selection interface
- Ensure color contrast meets WCAG AA standards
- Support for reduced motion preferences

### Success Criteria

**Functional Success:**

1. User can click "+" button on chatbar to open selection interface
2. Selection interface displays all users except those already in session
3. User can select a participant and successfully add them to the session
4. Member list updates immediately to show the new member
5. Errors display clear, user-friendly toast notifications
6. Feature works for both real users and AI agents/virtual users

**Technical Success:**

1. Integration uses existing `useAddUserToSession()` composable correctly
2. User list fetched via `useSelectableUsers()` composable
3. Current members filtered out from selection list
4. TanStack Query cache invalidation works automatically
5. No console errors or warnings
6. TypeScript types are correct with no `any` usage
7. Component follows Vue 3 Composition API best practices

**User Experience Success:**

1. Button is discoverable and clearly indicates its purpose
2. Selection interface is intuitive and easy to use
3. Action completes quickly with clear feedback
4. Keyboard navigation works smoothly
5. Error states are helpful and actionable
6. Feature feels integrated, not bolted-on

**Completion Validation:**

Use existing functionality to verify:
- Check session members array includes newly added user
- Verify member list UI displays new member
- Confirm backend session data reflects the addition
- Test error scenarios display appropriate messages
