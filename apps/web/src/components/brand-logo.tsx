import Image from 'next/image';
import Link from 'next/link';

export function BrandLogo({ reversed = false }: { readonly reversed?: boolean }) {
  return (
    <Link className="brand-logo" href="/" aria-label="Thriftage home">
      <Image
        alt=""
        aria-hidden="true"
        height={40}
        src={reversed ? '/brand/thriftage-mark-reversed.svg' : '/brand/thriftage-mark.svg'}
        width={40}
      />
      <span>Thriftage</span>
    </Link>
  );
}
