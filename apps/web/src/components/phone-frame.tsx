import Image from 'next/image';

export function PhoneFrame({
  alt,
  className = '',
  priority = false,
  screen,
}: {
  readonly alt: string;
  readonly className?: string;
  readonly priority?: boolean;
  readonly screen: string;
}) {
  return (
    <figure className={`phone-frame ${className}`.trim()}>
      <div className="phone-speaker" aria-hidden="true" />
      <div className="phone-screen">
        <Image
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 720px) 74vw, (max-width: 1100px) 36vw, 390px"
          src={screen}
        />
      </div>
    </figure>
  );
}
