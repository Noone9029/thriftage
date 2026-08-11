export function createPhoneSignInRequest(phone: string): {
  readonly options: { readonly shouldCreateUser: false };
  readonly phone: string;
} {
  return { options: { shouldCreateUser: false }, phone };
}
