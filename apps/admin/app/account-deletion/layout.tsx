import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  description: 'Request deletion of a Thriftage account and associated personal data.',
  robots: { follow: true, index: true },
  title: 'Delete your Thriftage account',
};

export default function AccountDeletionLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
