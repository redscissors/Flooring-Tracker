import { useId } from "react";

// "the ned" vertical lockup (logo kit, lockup/thened-vertical): plank-seam "n"
// glyph with "the" rotated 90° up the stem. Inlined instead of an <img> so the
// fills ride the --ft-* theme vars — ink/paper and moss flip with dark mode,
// which the kit's fixed-color SVG files can't do. Letterforms are outlined
// Manrope from the kit; don't hand-edit the path data.
// Size with `height` (px) or pass a style width — the aspect ratio holds.
export default function NedLogo({ height, style, className }) {
  const clip = useId();
  return (
    <svg
      viewBox="-21 14 182 73"
      role="img"
      aria-label="the ned"
      className={className}
      style={{ display: "block", aspectRatio: "182 / 73", height, width: height ? "auto" : undefined, ...style }}
    >
      <g transform="translate(0,30) scale(0.432) translate(-45,-40)">
        <defs><clipPath id={clip}><path d="M45,165 V40 H107 A48,48 0 0 1 155,88 V165 H125 V103 A25,25 0 0 0 75,103 V165 Z" /></clipPath></defs>
        <path d="M45,165 V40 H107 A48,48 0 0 1 155,88 V165 H125 V103 A25,25 0 0 0 75,103 V165 Z" fill="var(--ft-logo)" />
        <g clipPath={`url(#${clip})`} stroke="var(--ft-cream)" strokeWidth="4" fill="none">
          <line x1="59" y1="36" x2="59" y2="169" />
          <line x1="43" y1="50" x2="100" y2="80" />
          <line x1="88" y1="58" x2="157" y2="58" />
          <line x1="126" y1="60" x2="157" y2="114" />
          <line x1="139" y1="108" x2="139" y2="169" />
        </g>
      </g>
      <path transform="translate(-8 84) rotate(-90) translate(0.00 0) scale(0.00850 -0.0085)" d="M758 0Q656 -20 558 -17Q460 -14 383 21Q306 56 267 131Q232 198 229.5 267.5Q227 337 227 425L227 1380L437 1380L437 435Q437 370 438.5 322Q440 274 459 241Q495 179 573.5 170.5Q652 162 758 177ZM20 912L20 1080L758 1080L758 912Z" fill="var(--ft-brand)" />
      <path transform="translate(-8 84) rotate(-90) translate(7.52 0) scale(0.00850 -0.0085)" d="M898 0L898 531Q898 594 887.5 660.5Q877 727 847.5 784Q818 841 764.5 876Q711 911 625 911Q569 911 519 892.5Q469 874 431.5 833Q394 792 372.5 725Q351 658 351 562L221 611Q221 758 276 870.5Q331 983 434 1046Q537 1109 683 1109Q795 1109 871 1073Q947 1037 994.5 978.5Q1042 920 1067 851Q1092 782 1101 716Q1110 650 1110 600L1110 0ZM139 0L139 1440L326 1440L326 663L351 663L351 0Z" fill="var(--ft-brand)" />
      <path transform="translate(-8 84) rotate(-90) translate(18.31 0) scale(0.00850 -0.0085)" d="M619 -30Q458 -30 336.5 40.5Q215 111 147.5 237.5Q80 364 80 531Q80 708 146.5 838Q213 968 332 1039Q451 1110 609 1110Q774 1110 890 1033.5Q1006 957 1063.5 816Q1121 675 1109 481L900 481L900 557Q898 745 828.5 835Q759 925 617 925Q460 925 381 826Q302 727 302 540Q302 362 381 264.5Q460 167 609 167Q707 167 778.5 211.5Q850 256 890 339L1095 274Q1032 129 904 49.5Q776 -30 619 -30ZM234 481L234 644L1005 644L1005 481Z" fill="var(--ft-brand)" />
      <path transform="translate(51.50 84) scale(0.04800 -0.048)" d="M631 -30Q467 -30 343 41Q219 112 149.5 238Q80 364 80 528Q80 705 148.5 835.5Q217 966 337.5 1038Q458 1110 617 1110Q785 1110 902.5 1031.5Q1020 953 1077 810Q1134 667 1120 473L881 473L881 561Q880 737 819 818Q758 899 627 899Q480 899 407.5 807.5Q335 716 335 540Q335 376 407.5 286Q480 196 617 196Q706 196 770.5 235.5Q835 275 870 350L1108 278Q1047 132 917 51Q787 -30 631 -30ZM259 473L259 655L1002 655L1002 473Z" fill="var(--ft-logo)" />
      <path transform="translate(107.41 84) scale(0.04800 -0.048)" d="M573 -30Q424 -30 313 45Q202 120 141 249Q80 378 80 540Q80 704 142 833Q204 962 316.5 1036Q429 1110 582 1110Q736 1110 840.5 1035.5Q945 961 999 832Q1053 703 1053 540Q1053 379 999 249.5Q945 120 838 45Q731 -30 573 -30ZM610 186Q707 186 766.5 230.5Q826 275 853.5 355.5Q881 436 881 540Q881 646 853.5 725.5Q826 805 768 849.5Q710 894 618 894Q521 894 458 846.5Q395 799 365 718.5Q335 638 335 540Q335 441 364.5 360.5Q394 280 455 233Q516 186 610 186ZM881 0L881 758L851 758L851 1440L1094 1440L1094 0Z" fill="var(--ft-logo)" />
    </svg>
  );
}
