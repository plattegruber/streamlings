import type { Chatter } from './types.js';
import { getHvWeights, pickHvEventType } from './profiles.js';
import type { ProfileName } from './types.js';

const CHAT_MESSAGES = [
  'PogChamp', 'LUL', 'Kappa', 'monkaS', 'HYPERS',
  'GG', 'let\'s gooo', 'W', 'nice!', 'LMAO',
  'gg ez', 'hello chat', 'PepeLaugh', 'Sadge', 'catJAM',
  'OMEGALUL', 'Pog', 'COPIUM', 'based', 'true',
];

interface SendResult {
  ok: boolean;
  status: number;
}

function buildChatPayload(streamerId: string, chatter: Chatter) {
  return {
    subscription: { type: 'channel.chat.message' },
    event: {
      internal_user_id: streamerId,
      user_id: chatter.id,
      user_name: chatter.name,
      message: { text: CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)] },
    },
  };
}

function buildHvPayload(
  streamerId: string,
  chatter: Chatter,
  profile: Exclude<ProfileName, 'full-stream'>
) {
  const eventType = pickHvEventType(getHvWeights(profile));
  const base = {
    internal_user_id: streamerId,
    user_id: chatter.id,
    user_name: chatter.name,
  };

  switch (eventType) {
    case 'channel.subscribe':
      return {
        subscription: { type: eventType },
        event: { ...base, tier: '1000' },
      };
    case 'channel.cheer':
      return {
        subscription: { type: eventType },
        event: { ...base, bits: [100, 500, 1000, 5000][Math.floor(Math.random() * 4)] },
      };
    case 'channel.subscription.gift':
      return {
        subscription: { type: eventType },
        event: { ...base, total: [1, 5, 10, 25][Math.floor(Math.random() * 4)], tier: '1000' },
      };
    case 'channel.subscription.message':
      return {
        subscription: { type: eventType },
        event: { ...base, tier: '1000', message: { text: 'Resub hype!' } },
      };
    case 'channel.raid':
      return {
        subscription: { type: eventType },
        event: {
          ...base,
          from_broadcaster_user_name: chatter.name,
          viewers: [10, 50, 100, 500][Math.floor(Math.random() * 4)],
        },
      };
    default:
      return buildChatPayload(streamerId, chatter);
  }
}

export function buildEvent(
  streamerId: string,
  chatter: Chatter,
  isHv: boolean,
  profile: Exclude<ProfileName, 'full-stream'>
) {
  return isHv
    ? buildHvPayload(streamerId, chatter, profile)
    : buildChatPayload(streamerId, chatter);
}

export async function sendEvent(
  url: string,
  payload: object
): Promise<SendResult> {
  try {
    const res = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
