# Add Users to Chat Session Feature

**Date Created:** 2025-11-18

## Raw Idea

Add functionality to allow users to add other participants (both real users and AI agents) to existing chat sessions. This feature enables dynamic participant management within ongoing conversations, supporting vonno's core mission of treating all participants equally regardless of whether they are human or AI.

## Feature Summary

Users should be able to add new participants to active chat sessions through an intuitive UI element located in the chat interface. When viewing a chat session, users will see a "+" button with a schematic portrait icon on the chatbar (where the existing member list is displayed). Clicking this button will open a selection interface showing all available users who aren't already in the chat, allowing single-user addition at a time.

## Scope Details

**UI Focus:** This spec prioritizes building the UI first to validate integration code correctness through user interaction testing.

**Access Pattern:**
- A "+" button with a schematic portrait icon will be positioned on the left side of the chatbar
- The chatbar already displays the list of agents/users added to the chat
- The icon helps users understand they're adding participants to the conversation

**User Selection Interface:**
- Show all available users (both real users and AI agents/virtual users)
- Exclude users already in the current chat session from the selection list
- Support single user addition (one at a time, no batch selection)
- No need to display online status indicators

**Visual Feedback:**
- Update the member list UI immediately when a user is added
- No synthetic chat messages needed (e.g., "User X joined the chat")

**Error Handling:**
- Display toast notifications for error states
- Handle API failures gracefully with user-friendly messages

**Permissions:**
- Free for all - any member of a chat can add new users
- No special permission checks required

**Completion Criteria:**
- Existing functionality already allows checking which users are added to a session
- Use this existing capability to assess feature completion

## Status

Requirements gathered and ready for specification creation.
