export interface EnemyMove {
  name: string; type: 'attack' | 'defend' | 'heal'
  value: number; color: number; label: string
}
export interface EnemyDef {
  name: string; bodyColor: number; accentColor: number; hp: number; moves: EnemyMove[]
}

export const ENCOUNTERS: EnemyDef[] = [
  {
    name: 'Whelp', bodyColor: 0xb45309, accentColor: 0xd97706, hp: 35,
    moves: [
      { name: 'Scratch', type: 'attack', value: 4, color: 0xef4444, label: '🐾 Scratch · 4 dmg' },
      { name: 'Claw',    type: 'attack', value: 6, color: 0xdc2626, label: '⚔️ Claw · 6 dmg' },
    ],
  },
  {
    name: 'Brute', bodyColor: 0x7f1d1d, accentColor: 0xb91c1c, hp: 70,
    moves: [
      { name: 'Slam',  type: 'attack', value: 8,  color: 0xef4444, label: '💥 Slam · 8 dmg' },
      { name: 'Bite',  type: 'attack', value: 11, color: 0xdc2626, label: '🦷 Bite · 11 dmg' },
      { name: 'Guard', type: 'defend', value: 3,  color: 0x6366f1, label: '🔮 Guard · +3 absorb' },
    ],
  },
  {
    name: 'CORE', bodyColor: 0x1e1b4b, accentColor: 0x4338ca, hp: 120,
    moves: [
      { name: 'Crush',    type: 'attack', value: 10, color: 0xef4444, label: '⚡ Crush · 10 dmg' },
      { name: 'Surge',    type: 'attack', value: 15, color: 0xdc2626, label: '💀 Surge · 15 dmg' },
      { name: 'Fortify',  type: 'defend', value: 5,  color: 0x6366f1, label: '🔮 Fortify · +5 absorb' },
      { name: 'Recharge', type: 'heal',   value: 8,  color: 0x22c55e, label: '💚 Recharge · +8 HP' },
    ],
  },
]
