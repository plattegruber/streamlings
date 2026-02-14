/**
 * Extract the relevant Twitch user ID from an EventSub event.
 *
 * Different event types store the primary user in different fields:
 * - Chat / follow / cheer events → event.user_id (the acting user)
 * - Stream lifecycle (stream.online, stream.offline) → event.broadcaster_user_id
 * - Gift subs → event.to_broadcaster_user_id (the target broadcaster)
 *
 * Falls back to 'default_user' when no recognizable ID field is present.
 */
export function extractTwitchUserId(event: Record<string, unknown> | undefined): string {
	if (!event) return 'default_user';

	return (event.user_id as string)
		|| (event.broadcaster_user_id as string)
		|| (event.to_broadcaster_user_id as string)
		|| 'default_user';
}
