export type TwitchEventPayload = {
  subscription: { type: string };
  event: Record<string, unknown>;
};

export type InstallUserTokenBody = {
  token: string;
};
