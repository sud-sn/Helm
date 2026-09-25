/**
 * Checks an Azure OpenAI endpoint and keeps only the resource part, so a full "target URI"
 * copied from the Azure portal works too. https is required, except for a local test server.
 */
export function normalizeAzureEndpoint(
  raw: string,
): { ok: true; endpoint: string } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {
      ok: false,
      message: 'Use the endpoint URL, such as https://my-resource.openai.azure.com',
    };
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    return { ok: false, message: 'The endpoint must start with https://' };
  }
  return { ok: true, endpoint: url.origin };
}
