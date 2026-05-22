import { Redirect } from "expo-router";

/** Legacy route — demo UI starts at splash. */
export default function SignInRedirect() {
  return <Redirect href="/" />;
}
