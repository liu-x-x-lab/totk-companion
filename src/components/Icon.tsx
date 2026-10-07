import type { CSSProperties } from 'react';

export type IconName = 'map' | 'sword' | 'monster' | 'bookmark' | 'search' | 'plus' | 'minus' | 'target' | 'layers' | 'chevron' | 'close' | 'mountain' | 'shrine' | 'tower' | 'cave' | 'arrow' | 'download' | 'upload' | 'shield' | 'bow' | 'spark' | 'check';
const paths: Record<IconName, string[]> = {
  map: ['m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15M15 6v15'],
  sword: ['m14 3 7-1-1 7-9 9-5-5z', 'm4 15 5 5M6 18l-4 4M3 21l1 1'],
  monster: ['m4 9-1-6 5 3m12 3 1-6-5 3', 'M5 7h14l2 6-2 7H5l-2-7z', 'm7 11 3 2m7-2-3 2M9 17h6'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  search: ['M20 20l-5-5', 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  target: ['M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0', 'M12 9v6M9 12h6M12 1v3m0 16v3M1 12h3m16 0h3'],
  layers: ['m12 3 10 6-10 6L2 9z', 'm2 13 10 6 10-6m-20 4 10 6 10-6'],
  chevron: ['m9 5 7 7-7 7'],
  close: ['m6 6 12 12M6 18 18 6'],
  mountain: ['m2 20 8-15 4 7 2-4 6 12z', 'm8 9 2 3 2-3'],
  shrine: ['m12 3 9 18H3z', 'm12 10 5 8H7z'],
  tower: ['M9 21V9H6l6-6 6 6h-3v12M6 21h12M9 14h6'],
  cave: ['m2 21 3-12 7-6 7 6 3 12z', 'M8 21v-6a4 4 0 0 1 8 0v6'],
  arrow: ['M4 12h16m-6-6 6 6-6 6'],
  download: ['M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
  upload: ['M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5'],
  shield: ['m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6z'],
  bow: ['M6 3c16 4 16 14 0 18V3M6 12h15m-4-4 4 4-4 4'],
  spark: ['m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z'],
  check: ['m5 12 4 4 10-10'],
};

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name].map((d, i) => <path key={i} d={d} />)}</svg>;
}
