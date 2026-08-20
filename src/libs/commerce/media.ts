export function isDisplayableCommerceMediaUrl(url: string): boolean {
  return /^(https?:|blob:|data:)/i.test(url);
}
