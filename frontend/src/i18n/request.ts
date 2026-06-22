import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const cookieStore  = await cookies();
  const savedLocale  = cookieStore.get("fg_locale")?.value;

  let locale = savedLocale ?? "fr";

  if (!savedLocale) {
    const headersList = await headers();
    const acceptLang  = headersList.get("accept-language") ?? "";
    if (acceptLang.toLowerCase().startsWith("en")) locale = "en";
  }

  if (!["fr", "en"].includes(locale)) locale = "fr";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
