import { useState } from 'react';
import type { Equipment, EquipmentCategory } from '../types/domain';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const categoryIcons: Record<EquipmentCategory, IconName> = {
  'one-handed': 'sword', 'two-handed': 'sword', spear: 'sword', bow: 'bow', shield: 'shield', armor: 'shield',
};

export function EquipmentArt({ item }: { item: Equipment }) {
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  return <span className={`equipment-art equipment-${item.category}`} aria-hidden="true">
    {item.iconId && failedIcon !== item.iconId
      ? <img src={`/images/equipment/${item.iconId}.png`} alt="" width="64" height="64" loading="lazy" decoding="async" onError={() => setFailedIcon(item.iconId!)}/>
      : <Icon name={categoryIcons[item.category]} size={32}/>}
  </span>;
}
