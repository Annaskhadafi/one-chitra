---
type: community
cohesion: 0.11
members: 43
---

# getCurrentUserId()

**Cohesion:** 0.11 - loosely connected
**Members:** 43 nodes

## Members
- [[GET()_3]] - code - app\api\cron\chat-unread-reminders\route.ts
- [[GET()]] - code - app\api\chat\messages\route.ts
- [[assertMembership()]] - code - app\actions\chat.ts
- [[chat-schema.ts]] - code - lib\chat-schema.ts
- [[chat.ts]] - code - app\actions\chat.ts
- [[createGroupRoom()]] - code - app\actions\chat.ts
- [[deleteChatRoom()]] - code - app\actions\chat.ts
- [[deleteMessage()]] - code - app\actions\chat.ts
- [[deleteUserSticker()]] - code - app\actions\chat.ts
- [[editMessage()]] - code - app\actions\chat.ts
- [[enrichMessages()]] - code - app\actions\chat.ts
- [[ensureChatSchema()]] - code - lib\chat-schema.ts
- [[generateHelpDeskReplyForRoom()]] - code - app\actions\chat.ts
- [[getChatUsers()]] - code - app\actions\chat.ts
- [[getCurrentUser()]] - code - app\actions\chat.ts
- [[getCurrentUserId()]] - code - app\actions\chat.ts
- [[getMemberRows()]] - code - app\actions\chat.ts
- [[getOrCreateDmRoom()]] - code - app\actions\chat.ts
- [[getRoomMessages()]] - code - app\actions\chat.ts
- [[getRoomSnapshotInternal()]] - code - app\actions\chat.ts
- [[getSessionUser()]] - code - app\actions\chat.ts
- [[getUnreadChatReminders()]] - code - app\actions\chat.ts
- [[getUserRooms()]] - code - app\actions\chat.ts
- [[getUserSavedStickers()]] - code - app\actions\chat.ts
- [[handleCreate()_1]] - code - components\chat\chat-widget.tsx
- [[markUnreadChatReminderSent()]] - code - app\actions\chat.ts
- [[normalizeAttachments()]] - code - app\actions\chat.ts
- [[normalizeMentionedUserIds()]] - code - app\actions\chat.ts
- [[normalizeReactions()]] - code - app\actions\chat.ts
- [[normalizeStickerName()]] - code - app\actions\chat.ts
- [[route.ts_2]] - code - app\api\chat\messages\route.ts
- [[route.ts_6]] - code - app\api\cron\chat-unread-reminders\route.ts
- [[saveUserSticker()]] - code - app\actions\chat.ts
- [[searchDocumentsForMention()]] - code - app\actions\chat.ts
- [[searchRoomMessages()]] - code - app\actions\chat.ts
- [[sendMessage()]] - code - app\actions\chat.ts
- [[syncChatSchema()]] - code - lib\chat-schema.ts
- [[toggleMessageReaction()]] - code - app\actions\chat.ts
- [[togglePinMessage()]] - code - app\actions\chat.ts
- [[touchMembership()]] - code - app\actions\chat.ts
- [[updateGroupRoom()]] - code - app\actions\chat.ts
- [[updateRoomPreferences()]] - code - app\actions\chat.ts
- [[updateTypingStatus()]] - code - app\actions\chat.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getCurrentUserId()
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_sendSystemTemplatedEmailByCode()]]
- 2 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 1 edge to [[_COMMUNITY_readManagedUpload()]]
- 1 edge to [[_COMMUNITY_renderPdfToImages()]]
- 1 edge to [[_COMMUNITY_getGeneratedAvatarDataUri()]]

## Top bridge nodes
- [[GET()_3]] - degree 7, connects to 2 communities
- [[sendMessage()]] - degree 7, connects to 1 community
- [[saveUserSticker()]] - degree 5, connects to 1 community
- [[generateHelpDeskReplyForRoom()]] - degree 4, connects to 1 community
- [[searchDocumentsForMention()]] - degree 3, connects to 1 community