/** UI-only mock data when true. Connected staging is the default. */
export const IS_MOCK_UI = process.env.EXPO_PUBLIC_MOCK_UI === "true";

export const IS_CONNECTED_DEMO = !IS_MOCK_UI;
