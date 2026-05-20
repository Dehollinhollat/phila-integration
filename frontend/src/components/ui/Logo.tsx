import logoUrl from '../../assets/images/LOGO-PHILA-BLEU.png';

interface LogoProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

export default function Logo({ width = 36, height = 36, style }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Phila"
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        objectFit: 'contain',
        objectPosition: 'center',
        display: 'block',
        borderRadius: '50%',
        background: 'white',
        ...style,
      }}
    />
  );
}
