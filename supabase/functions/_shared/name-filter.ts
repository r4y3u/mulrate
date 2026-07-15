const JAPANESE_CONTAINS = [
  'あなる', 'いらまちお', 'おっぱい', 'おまんこ', 'せいえき', 'ふぁっく', 'うんこ', 'うんち',
  'おしっこ', 'おなにー', 'おなる', 'おめこ', 'がいじ', 'きちがい', 'きんたま', 'くろんぼ',
  'くりとりす', 'けつあな', 'ごうかん', 'せっくす', 'ちんこ', 'ちんちん', 'ちんぽ', 'にがー',
  'にぐろ', 'ふぇら', 'ぺにす', 'まんこ', 'めくら', 'りょうじょく', 'れいぷ', 'ろりこん',
  'ひとらー', 'なちす', 'ころして', 'しんで', 'じさつしろ'
];
const JAPANESE_EXACT = ['あほ', 'きえて', 'きえろ', 'くたばれ', 'ころす', 'しね', 'しぬ', 'やらせろ', 'どかた', 'つんぼ', 'びっこ', 'かたわ', 'ぶらく', 'ちゃんころ'];
const JAPANESE_SUFFIX = ['しね', 'ころす', 'くたばれ', 'きえろ'];
const LATIN_CONTAINS = [
  'analplug', 'analsex', 'blowjob', 'bullshit', 'cocksucker', 'cumshot', 'dickhead', 'ejaculate',
  'faggot', 'goddamn', 'handjob', 'jesussucks', 'masturbate', 'paedophile', 'pedophile', 'pedofile',
  'pornography', 'rapist', 'scrotum', 'towelhead', 'vagina', 'wetback', 'whore', 'nigger', 'nigga',
  'fucker', 'motherfucker', 'fascist', 'hitler', 'nazism', 'suicide', 'incest', 'clitoris', 'dildo', 'fuck', 'cunt'
];
const LATIN_EXACT = [
  'acab', 'anal', 'ass', 'bastard', 'bitch', 'bj', 'chink', 'clit', 'cock', 'coon', 'cum', 'damn',
  'dick', 'dike', 'dyke', 'fag', 'fags', 'fcuk', 'fuct', 'fuk', 'fvck', 'gook', 'gypo', 'homo',
  'hore', 'isis', 'isil', 'jism', 'jizz', 'jizzum', 'kaffir', 'kike', 'kill', 'killer', 'kkk',
  'kunt', 'lesbo', 'molest', 'nazi', 'negro', 'paedo', 'paki', 'pecker', 'pedo', 'penis', 'phuk',
  'piss', 'poof', 'poon', 'porn', 'pussy', 'rape', 'raped', 'rapes', 'sex', 'shit', 'shiz', 'slag',
  'slut', 'spastic', 'spaz', 'sperm', 'spunk', 'tits', 'twat', 'vag', 'vulva', 'wank', 'wanker',
  'wog', 'kz', 'sa', 'ss'
];
const RESERVED_EXACT = ['admin', 'administrator', 'moderator', 'official', 'support', 'mulrate', '運営', '管理者', '公式', 'サポート'];

function toHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}
function compact(value: unknown): string {
  return Array.from(String(value ?? '').normalize('NFKC').toLowerCase())
    .filter((char) => /[\p{L}\p{N}]/u.test(char)).join('');
}
function latinSkeleton(value: string): string {
  const table: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' };
  return value.replace(/[0134578]/g, (char) => table[char] ?? char);
}

export function isAllowedNickname(value: unknown): boolean {
  const normalized = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const chars = Array.from(normalized);
  if (chars.length < 1 || chars.length > 12) return false;
  if (!chars.every((char) => /[\p{L}\p{N}_・ー\- ]/u.test(char))) return false;
  const raw = compact(normalized);
  const japanese = toHiragana(raw);
  const latin = latinSkeleton(raw);
  if (RESERVED_EXACT.includes(raw) || RESERVED_EXACT.includes(japanese)) return false;
  if (JAPANESE_EXACT.includes(japanese)) return false;
  if (JAPANESE_CONTAINS.some((word) => japanese.includes(word))) return false;
  if (JAPANESE_SUFFIX.some((word) => japanese.length > word.length && japanese.endsWith(word))) return false;
  if (LATIN_EXACT.includes(latin)) return false;
  if (LATIN_CONTAINS.some((word) => latin.includes(word))) return false;
  return true;
}
