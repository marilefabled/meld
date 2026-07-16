import type { EnemyDef } from './encounters.js'

export interface CandyRival {
  speaker: string
  opening: string
  defeat: string
}

const RIVALS: Record<string, CandyRival> = {
  'The Crimp': {
    speaker: 'THE CRIMP · WRAPPER ADJUTANT',
    opening: 'Fruit is candy with a press release. You can stop insisting now.',
    defeat: 'Keep the word fruit. We will keep the factories.',
  },
  Crimp: {
    speaker: 'CRIMP · FIELD SEALER',
    opening: 'A wrapper is a wrapper. You are not above the seam.',
    defeat: 'The seam opened. That is not the same as being right.',
  },
  'Hard Set': {
    speaker: 'HARD SET · TOFFEE GUARD',
    opening: 'We do not call you lesser. We call you soft.',
    defeat: 'Softness survives impact. I had forgotten that.',
  },
  'Hard Chew': {
    speaker: 'HARD CHEW · SUGAR MILITIA',
    opening: 'Fruit Front standards. Candy standards. Same sugar. Different uniforms.',
    defeat: 'Do not mistake a dent for a conversion.',
  },
  'The Last Drop': {
    speaker: 'THE LAST DROP · SYRUP MINISTER',
    opening: 'You know what we call fruit in a drought? Candy.',
    defeat: 'You spend yourselves like you are still growing on trees.',
  },
  'Juice Bloom': {
    speaker: 'JUICE BLOOM · REFILLER',
    opening: 'Your pulp is not a passport. It is an ingredient.',
    defeat: 'You bled filling for a flag. I almost respect it.',
  },
  Sachet: {
    speaker: 'SACHET · COURT CUSTODIAN',
    opening: 'Candy keeps a clean shelf. Fruit calls that tyranny.',
    defeat: 'The shelf is still there. Someone will straighten it.',
  },
  'Flash Seal': {
    speaker: 'FLASH SEAL · CANDY COURIER',
    opening: 'You want to be wild. You want to be individually wrapped. Pick one.',
    defeat: 'Fine. Be difficult. It looks expensive on you.',
  },
  'Brick Bite': {
    speaker: 'BRICK BITE · CARAMEL CAPTAIN',
    opening: 'We learned pressure from Fruit. We just stopped apologizing for it.',
    defeat: 'That is the trouble with cousins. They remember your first shape.',
  },
  'Rind Wall': {
    speaker: 'RIND WALL · HARD CANDY LINE',
    opening: 'Your rind is just armor with a prettier manifesto.',
    defeat: 'Keep telling yourselves the difference matters. It might, someday.',
  },
  Refill: {
    speaker: 'REFILL · SYRUP ENGINEER',
    opening: 'Candy does not fear hunger. We designed around it.',
    defeat: 'That was not hunger. That was belief.',
  },
  Tangle: {
    speaker: 'TANGLE · LICORICE ATTACHÉ',
    opening: 'Every Fruit Front speech ends the same way: with somebody needing sugar.',
    defeat: 'You cannot unmix a world by shouting at it.',
  },
  'Hard Seal': {
    speaker: 'HARD SEAL · COURT MARSHAL',
    opening: 'The Court offered classification. You chose a war over a label.',
    defeat: 'Then carry your difference. It is heavier than it looks.',
  },
  'Blank Pack': {
    speaker: 'BLANK PACK · QUALITY CONTROL',
    opening: 'A flavor nobody can name is a defect with a better publicist.',
    defeat: 'The record will say you were candy. The record is wrong.',
  },
  'Gummy Vault': {
    speaker: 'GUMMY VAULT · CANDY TREASURY',
    opening: 'Fruit Front purity is a luxury good. Somebody always pays for it.',
    defeat: 'Take the stock. The ledger will remember who broke it.',
  },
  'The Block': {
    speaker: 'THE BLOCK · NOUGAT COMMAND',
    opening: 'You call us a machine because we learned to stand together.',
    defeat: 'Stand together, then. Do not turn into us doing it.',
  },
  'The Gulp': {
    speaker: 'THE GULP · SYRUP COLOSSUS',
    opening: 'Fruit is Candy with a childhood memory. That is all.',
    defeat: 'Memories make terrible armor. You used yours anyway.',
  },
  'The Flood': {
    speaker: 'THE FLOOD · LIQUID CANDY COMMAND',
    opening: 'There is no front. There is only sugar moving toward its container.',
    defeat: 'Then you found a container that would not close.',
  },
  'THE ORIGINAL': {
    speaker: 'THE ORIGINAL · CANDY COURT',
    opening: 'I am the proof you keep asking Candy not to make.',
    defeat: 'Call it fruit, then. Make the word mean something.',
  },
}

function fallbackRival(def: EnemyDef): CandyRival {
  const trait = def.traits?.[0]?.kind
  const claim = trait === 'immune'
    ? 'Candy glaze keeps the noise out. Yours is not a special case.'
    : trait === 'armored'
      ? 'Every soft thing wants a harder name. We can give you one.'
      : 'Fruit runs dry. Candy designs around the weather.'
  return {
    speaker: `${def.name.toUpperCase()} · CANDY COURT`,
    opening: claim,
    defeat: 'The Court will call this an exception. You will call it a line.',
  }
}

export function candyRivalFor(def: EnemyDef): CandyRival {
  return RIVALS[def.name] ?? fallbackRival(def)
}
