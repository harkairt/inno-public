Lets implement the feature of listing the available users to chat with.
- right after the user logs in the app lands at `/chats` route
- the `Chats` layout must have a Siderbar on the left with 1 option: `Users`  which is an expandable tile that lists the users
- The first element of the list is a searchbox, which does offline filtering (by name) of the users
- no interaction as of now for tapping the users
- use the `useSelectableUsers` composable