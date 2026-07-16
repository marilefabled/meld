export interface CourtLetter {
  fileNo: string
  date: string
  sender: string
  recipient: string
  subject: string
  paragraphs: string[]
  signoff: string
}

const LETTERS: CourtLetter[] = [
  {
    fileNo: 'FIELD FILE 01 / WESTERN AISLE',
    date: '14 APRIL / CROP YEAR UNKNOWN',
    sender: 'Lt. Col. Marzipan, Fourth Shelf Reserve',
    recipient: 'Office of Food Classification, Candy Court',
    subject: 'THE LOCAL FRUIT QUESTION',
    paragraphs: [
      'Sir: the material occupying the loose end of Aisle Six continues to identify itself as fruit. It is sweet, portable, and sold by the box. This has not settled the matter.',
      'When presented with the customary wrapper, the locals declined it on moral grounds. A brief exchange followed. Their use of the word natural should be noted for future interrogations.',
      'Request additional sealing equipment and one clerk who can say “technically fruit” without smiling.',
    ],
    signoff: 'Respectfully submitted, pending clarification.',
  },
  {
    fileNo: 'FIELD FILE 02 / HARD GOODS COMMAND',
    date: '03 JUNE / CONTINUED OPERATIONS',
    sender: 'Maj. Caramel, Forward Ration Office',
    recipient: 'Deputy Minister for Shelf Order',
    subject: 'ON THE FAILURE OF EASY CLASSIFICATION',
    paragraphs: [
      'Madam: the Fruit Front has broken three seals and has mistaken this administrative inconvenience for a position of principle.',
      'Their units remain brightly colored, irregularly filled, and difficult to stack. They refer to these defects as standards. Several of our younger personnel have begun repeating the phrase.',
      'Recommend a firm public statement that no edible item becomes fruit merely by remembering a tree.',
    ],
    signoff: 'For order, consistency, and the ordinary wrapper.',
  },
  {
    fileNo: 'FIELD FILE 03 / OFFICE OF FINAL PACKAGING',
    date: '29 SEPTEMBER / AFTER THE THIRD REPORT',
    sender: 'Commissioner Nougat, Court Surveyor',
    recipient: 'The Original, by sealed channel',
    subject: 'ESCALATION OF THE FRUIT CLAIM',
    paragraphs: [
      'Your Excellency: the local disturbance now calls itself a realistic fruit snack simulation. This phrase has been entered into the record exactly as heard.',
      'The claim has spread beyond the initial bags. Fruit units have mixed flavors, carried injuries, and refused every sensible opportunity to become easier to describe.',
      'We can still close the matter. We must first decide whether a closed matter is the same thing as a settled one.',
    ],
    signoff: 'Filed without endorsement.',
  },
  {
    fileNo: 'FINAL MEMORANDUM / ORIGIN VAULT',
    date: 'UNDATED / FOR INTERNAL EYES ONLY',
    sender: 'Office of the Original',
    recipient: 'All remaining Candy personnel',
    subject: 'ON THE APPROACHING MIRROR',
    paragraphs: [
      'Personnel are reminded that the Fruit Front is not to be romanticized. It is disorganized, sentimental, and alarmingly willing to make a word mean what it says.',
      'Do not call them cousins in their hearing. Do not call them candy in yours. Both statements have proved operationally expensive.',
      'The final witness will be admitted without ceremony. Preserve the record. Preserve the seal if possible.',
    ],
    signoff: 'By order of the Candy Court.',
  },
]

export function courtLetterForRun(runNumber: number): CourtLetter {
  return LETTERS[Math.max(0, Math.min(runNumber, LETTERS.length - 2))]
}

export function courtFinalMemorandum(): CourtLetter {
  return LETTERS[LETTERS.length - 1]
}
